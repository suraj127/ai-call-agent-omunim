import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { pcmTo16k, decodeAudioData, decode } from '../utils/audioUtils';

export enum LiveStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface DemoBooking {
  id: string;
  scheduledTime: string;
  customerName?: string;
  notes?: string;
  timestamp: string;
}

interface UseGeminiLiveProps {
    onBooking?: (booking: DemoBooking) => void;
}

interface UseGeminiLiveReturn {
  status: LiveStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
  isSpeaking: boolean;
  audioLevel: number;
  error: string | null;
}

export const useGeminiLive = ({ onBooking }: UseGeminiLiveProps = {}): UseGeminiLiveReturn => {
  const [status, setStatus] = useState<LiveStatus>(LiveStatus.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Audio & API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Stable ref for callback to avoid effect re-runs
  const onBookingRef = useRef(onBooking);
  useEffect(() => {
      onBookingRef.current = onBooking;
  }, [onBooking]);

  const disconnect = useCallback(() => {
    // 1. Stop Animation
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }

    // 2. Stop Processor
    if (processorRef.current) {
        try {
            processorRef.current.disconnect();
        } catch (e) {}
        processorRef.current = null;
    }

    // 3. Stop all playing sources
    sourceNodesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourceNodesRef.current.clear();

    // 4. Stop mic stream
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }

    // 5. Close Audio Context
    if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
            try { audioContextRef.current.close(); } catch(e) {}
        }
        audioContextRef.current = null;
    }

    setStatus(LiveStatus.DISCONNECTED);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  // Visualizer Loop
  const visualize = useCallback(() => {
    if (!audioContextRef.current || status === LiveStatus.DISCONNECTED) {
       return;
    }

    if (inputAnalyserRef.current) {
        const dataArray = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
        inputAnalyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        const len = dataArray.length;
        for (let i = 0; i < len; i++) {
          sum += dataArray[i];
        }
        const average = sum / len;
        setAudioLevel(average / 128); 
    } else if (isSpeaking) {
        // Fallback simulated level if analyzer not attached but speaking
        setAudioLevel(prev => Math.max(0.2, Math.min(0.8, prev + (Math.random() - 0.5) * 0.2)));
    }

    animationFrameRef.current = requestAnimationFrame(visualize);
  }, [isSpeaking, status]);

  // Start Visualizer when connected
  useEffect(() => {
    if (status === LiveStatus.CONNECTED) {
        visualize();
    }
  }, [status, visualize]);

  const connect = useCallback(async () => {
    if (status === LiveStatus.CONNECTING || status === LiveStatus.CONNECTED) return;

    setStatus(LiveStatus.CONNECTING);
    setError(null);

    try {
        // 1. Initialize Audio Context
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass(); 
        
        // Explicitly resume - critical for mobile browsers after backgrounding
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        audioContextRef.current = audioContext;
        const sampleRate = audioContext.sampleRate;
        
        // 2. Get User Media (Mic)
        // Note: On iOS/Android, if the app is backgrounded (dialer opens), this stream might pause.
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                // Requesting low latency mode if available
                // @ts-ignore
                latency: 0
            } 
        });
        streamRef.current = stream;

        // Visualizer Setup
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        inputAnalyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // 3. Connect to Gemini Live API
        const apiKey = process.env.API_KEY || "AIzaSyCPpq0DbrvMRG8h2YotctMeVEdFsmUfM-U"; 
        
        const ai = new GoogleGenAI({ apiKey });
        
        const bookDemoTool = {
            functionDeclarations: [{
                name: 'bookDemo',
                description: 'Book a software demo when the user agrees and provides a preferred time.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        scheduledTime: { type: Type.STRING, description: "The time the user wants the demo (e.g., 'Tomorrow 10 AM', 'Evening')." },
                        customerName: { type: Type.STRING, description: "The name of the customer if mentioned." }
                    },
                    required: ['scheduledTime']
                }
            }]
        };

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: SYSTEM_INSTRUCTION,
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                },
                tools: [bookDemoTool]
            },
            callbacks: {
                onopen: () => {
                    setStatus(LiveStatus.CONNECTED);
                    
                    // Low latency buffer size (2048 instead of 4096)
                    // 2048 frames @ 48kHz ~= 42ms latency
                    const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
                    processorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (e) => {
                        // Check if we are still connected before processing
                        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;

                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = pcmTo16k(inputData, sampleRate);
                        
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        }).catch(err => {
                            // If socket sends fail, connection is likely dead
                            console.warn("Socket send failed", err);
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Audio Output
                    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) {
                        setIsSpeaking(true);
                        
                        if (!audioContextRef.current) return;
                        
                        if (nextStartTimeRef.current < audioContext.currentTime) {
                             nextStartTimeRef.current = audioContext.currentTime;
                        }

                        try {
                            const audioBuffer = await decodeAudioData(
                                decode(base64Audio),
                                audioContext,
                                sampleRate, 
                                1
                            );

                            const sourceNode = audioContext.createBufferSource();
                            sourceNode.buffer = audioBuffer;
                            sourceNode.connect(audioContext.destination);
                            
                            sourceNode.onended = () => {
                                sourceNodesRef.current.delete(sourceNode);
                                if (sourceNodesRef.current.size === 0) {
                                    setIsSpeaking(false);
                                }
                            };
                            
                            sourceNode.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourceNodesRef.current.add(sourceNode);
                        } catch (e) {
                            console.error("Audio decode error", e);
                        }
                    }

                    // Interruption
                    if (message.serverContent?.interrupted) {
                        sourceNodesRef.current.forEach(node => {
                            try { node.stop(); } catch(e) {}
                        });
                        sourceNodesRef.current.clear();
                        if(audioContextRef.current) nextStartTimeRef.current = audioContext.currentTime;
                        setIsSpeaking(false);
                    }

                    // Tool Calls
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                             if (fc.name === 'bookDemo') {
                                 const args = fc.args as any;
                                 const booking: DemoBooking = {
                                     id: Date.now().toString(),
                                     scheduledTime: args.scheduledTime || 'Unspecified',
                                     customerName: args.customerName || 'Jeweller',
                                     timestamp: new Date().toLocaleString(),
                                     notes: 'Booked via Gemini AI Agent'
                                 };
                                 
                                 if (onBookingRef.current) onBookingRef.current(booking);

                                 sessionPromise.then(session => {
                                     session.sendToolResponse({
                                         functionResponses: {
                                             id: fc.id,
                                             name: fc.name,
                                             response: { result: "Booking confirmed." }
                                         }
                                     });
                                 }).catch(() => {});
                             }
                        }
                    }
                },
                onclose: () => {
                    console.log("Session closed");
                    disconnect();
                },
                onerror: (e) => {
                    console.error("Gemini Live Error:", e);
                    setError("Connection Lost. Resume manually.");
                    disconnect();
                }
            }
        });
        
        await sessionPromise;

    } catch (err: any) {
        console.error("Connection failed:", err);
        setError("Check Mic/Network");
        setStatus(LiveStatus.ERROR);
        disconnect();
    }
  }, [disconnect, visualize, status]); 

  // Cleanup on unmount
  useEffect(() => {
      return () => disconnect();
  }, [disconnect]);

  return {
    status,
    connect,
    disconnect,
    isSpeaking,
    audioLevel,
    error
  };
};
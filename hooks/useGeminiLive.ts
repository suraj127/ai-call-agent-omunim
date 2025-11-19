
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { createBlob, decodeAudioData, decode } from '../utils/audioUtils';

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
  
  // Stable ref for callback to avoid effect re-runs
  const onBookingRef = useRef(onBooking);
  useEffect(() => {
      onBookingRef.current = onBooking;
  }, [onBooking]);

  // Helper to manage audio visualization
  const visualize = useCallback(() => {
    if (!inputAnalyserRef.current || status !== LiveStatus.CONNECTED) {
       if (isSpeaking) {
          // Simulated level for output if we aren't analyzing output stream directly
          setAudioLevel(prev => Math.max(0.2, Math.min(0.8, prev + (Math.random() - 0.5) * 0.2)));
          animationFrameRef.current = requestAnimationFrame(visualize);
       } else {
          setAudioLevel(0.05);
          animationFrameRef.current = requestAnimationFrame(visualize);
       }
       return;
    }

    const dataArray = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
    inputAnalyserRef.current.getByteFrequencyData(dataArray);
    
    let sum = 0;
    const len = dataArray.length;
    for (let i = 0; i < len; i++) {
      sum += dataArray[i];
    }
    const average = sum / len;
    // Normalize roughly 0-1
    setAudioLevel(average / 128); 
    animationFrameRef.current = requestAnimationFrame(visualize);
  }, [isSpeaking, status]);

  const disconnect = useCallback(() => {
    // Stop all playing sources
    sourceNodesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourceNodesRef.current.clear();

    // Stop mic stream
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }

    // Close Audio Context
    if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch(e) {}
        audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }

    setStatus(LiveStatus.DISCONNECTED);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  const connect = useCallback(async () => {
    setStatus(LiveStatus.CONNECTING);
    setError(null);

    try {
        // 1. Initialize Audio Context
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        // Request 16kHz for input to match Gemini defaults if possible
        const audioContext = new AudioContextClass({ sampleRate: 16000 }); 
        await audioContext.resume();
        audioContextRef.current = audioContext;
        
        // Output context for playing audio (Gemini usually sends 24kHz)
        const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
        await outputAudioContext.resume();
        
        // 2. Get User Media (Mic)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Visualizer Setup
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        inputAnalyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser); // Connect mic to analyser

        // 3. Connect to Gemini Live API
        const apiKey = "AIzaSyCPpq0DbrvMRG8h2YotctMeVEdFsmUfM-U";
        
        if (!apiKey) {
            throw new Error("API_KEY not found");
        }

        const ai = new GoogleGenAI({ apiKey });
        
        // Define Tools
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
                    // Use 'Zephyr' or 'Puck' for reliable voice generation
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                },
                tools: [bookDemoTool]
            },
            callbacks: {
                onopen: () => {
                    setStatus(LiveStatus.CONNECTED);
                    visualize(); // Start visualizing
                    
                    // Process Mic Audio -> Gemini
                    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination);

                    // IMMEDIATE START TRIGGER: Send silence to establish stream
                    // We rely on System Instruction to make the model speak first, 
                    // but sending an input (even silence) often wakes up the session processing.
                    // Added small delay to ensure socket is fully stable.
                    setTimeout(() => {
                        sessionPromise.then(session => {
                             const silence = new Float32Array(1600); // ~0.1s silence
                             const pcmBlob = createBlob(silence);
                             session.sendRealtimeInput({ media: pcmBlob });
                        });
                    }, 100);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle Audio Output
                    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) {
                        setIsSpeaking(true);
                        
                        // Sync playback time
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);

                        const audioBuffer = await decodeAudioData(
                            decode(base64Audio),
                            outputAudioContext,
                            24000,
                            1
                        );

                        const sourceNode = outputAudioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(outputAudioContext.destination);
                        
                        sourceNode.onended = () => {
                            sourceNodesRef.current.delete(sourceNode);
                            if (sourceNodesRef.current.size === 0) {
                                setIsSpeaking(false);
                            }
                        };
                        
                        sourceNode.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourceNodesRef.current.add(sourceNode);
                    }

                    // Handle Interruption
                    if (message.serverContent?.interrupted) {
                        sourceNodesRef.current.forEach(node => {
                            try { node.stop(); } catch(e) {}
                        });
                        sourceNodesRef.current.clear();
                        nextStartTimeRef.current = 0;
                        setIsSpeaking(false);
                    }

                    // Handle Tool Calls
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

                                 // Respond to model
                                 sessionPromise.then(session => {
                                     session.sendToolResponse({
                                         functionResponses: {
                                             id: fc.id,
                                             name: fc.name,
                                             response: { result: "Booking confirmed successfully." }
                                         }
                                     });
                                 });
                             }
                        }
                    }
                },
                onclose: () => {
                    disconnect();
                },
                onerror: (e) => {
                    console.error("Gemini Live Error:", e);
                    setError("Connection interrupted");
                    disconnect();
                }
            }
        });

    } catch (err: any) {
        console.error("Connection failed:", err);
        setError(err.message || "Failed to connect to AI");
        setStatus(LiveStatus.ERROR);
    }
  }, [disconnect, visualize]); // Removed onBooking dependency to rely on ref

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

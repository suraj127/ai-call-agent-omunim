import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { MODEL_NAME, SYSTEM_INSTRUCTION, VOICE_NAME, BOOK_DEMO_TOOL } from '../constants';

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

export interface ConnectOptions {
    systemInstruction?: string;
}

interface UseGeminiLiveProps {
    onBooking?: (booking: DemoBooking) => void;
}

interface UseGeminiLiveReturn {
  status: LiveStatus;
  connect: (options?: ConnectOptions) => Promise<void>;
  disconnect: () => void;
  isSpeaking: boolean;
  audioLevel: number; // For visualizer (0-1)
  error: string | null;
}

// Helper to safely get API Key
const getApiKey = () => {
  try {
    // Priority 1: Environment Variable (Best Practice for Production)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore env errors
  }
  // Priority 2: Fallback to user-provided key for immediate demo use
  return "AIzaSyCPpq0DbrvMRG8h2YotctMeVEdFsmUfM-U";
};

export const useGeminiLive = ({ onBooking }: UseGeminiLiveProps = {}): UseGeminiLiveReturn => {
  const [status, setStatus] = useState<LiveStatus>(LiveStatus.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio context and processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // We store the promise here to use in callbacks, avoiding top-level await blocking
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Keep latest ref of callback to avoid reconnection on prop change
  const onBookingRef = useRef(onBooking);
  useEffect(() => {
      onBookingRef.current = onBooking;
  }, [onBooking]);

  const cleanup = useCallback(() => {
    if (sessionPromiseRef.current) {
       sessionPromiseRef.current.then(session => {
           try { session.close(); } catch(e) { console.error("Error closing session", e); }
       }).catch(() => {});
       sessionPromiseRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch(e) {}
      inputAudioContextRef.current = null;
    }

    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch(e) {}
      outputAudioContextRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  const visualize = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    setAudioLevel(average / 128); // Normalize somewhat

    animationFrameRef.current = requestAnimationFrame(visualize);
  }, []);

  const connect = useCallback(async (options?: ConnectOptions) => {
    // Cleanup any existing session first
    cleanup();

    try {
      setStatus(LiveStatus.CONNECTING);
      setError(null);

      const apiKey = getApiKey();
      if (!apiKey) {
         // Return a specific error code that App.tsx can detect to show instructions
         throw new Error("API_KEY_MISSING");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Note: Some browsers might not support 16000 natively, but we request it.
      const inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
      const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
      
      // CRITICAL: Resume contexts immediately (needed for some browsers)
      await inputAudioContext.resume();
      await outputAudioContext.resume();

      inputAudioContextRef.current = inputAudioContext;
      outputAudioContextRef.current = outputAudioContext;

      // Setup Analyser for Visualizer (Monitor Output)
      const analyser = outputAudioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
          },
          systemInstruction: options?.systemInstruction || SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [BOOK_DEMO_TOOL] }],
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Opened');
            setStatus(LiveStatus.CONNECTED);
            visualize(); // Start visualizer

            if (!inputAudioContextRef.current || !streamRef.current) return;

            // Stream audio from the microphone to the model
            const source = inputAudioContext.createMediaStreamSource(streamRef.current);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!inputAudioContextRef.current) return; // Guard against cleanup
              
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              // Send data only when session is ready
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => {
                  // Suppress errors during shutdown/network issues to prevent spam
              });
            };

            // Connect inputs
            source.connect(scriptProcessor);
            
            // CRITICAL: Connect script processor to a silence node (mute)
            // This keeps the processor running but prevents audio feedback (echo)
            const silenceNode = inputAudioContext.createGain();
            silenceNode.gain.value = 0;
            scriptProcessor.connect(silenceNode);
            silenceNode.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Function Calling
             if (message.toolCall) {
                const functionResponses = [];
                for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === BOOK_DEMO_TOOL.name) {
                        const args = fc.args as any;
                        console.log("Tool called:", fc.name, args);
                        
                        const newBooking: DemoBooking = {
                            id: crypto.randomUUID(),
                            scheduledTime: args.scheduledTime,
                            customerName: args.customerName || "Unknown Customer",
                            notes: args.notes,
                            timestamp: new Date().toLocaleString(),
                        };
                        
                        // Trigger callback to parent
                        if (onBookingRef.current) {
                            onBookingRef.current(newBooking);
                        }

                        functionResponses.push({
                            id: fc.id,
                            name: fc.name,
                            response: { result: "Demo scheduled successfully. Confirm this to the user." }
                        });
                    }
                }

                if (functionResponses.length > 0) {
                    sessionPromise.then((session) => {
                        session.sendToolResponse({ functionResponses });
                    });
                }
             }

             // Handle Audio Output from Gemini
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             
             if (base64Audio) {
                setIsSpeaking(true);
                
                nextStartTimeRef.current = Math.max(
                    nextStartTimeRef.current,
                    outputAudioContext.currentTime
                );

                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    outputAudioContext,
                    24000,
                    1
                );

                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(analyser); 
                analyser.connect(outputAudioContext.destination);

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                sourcesRef.current.add(source);

                source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) {
                        setIsSpeaking(false);
                    }
                };
             }

             const interrupted = message.serverContent?.interrupted;
             if (interrupted) {
                 console.log("Model interrupted");
                 sourcesRef.current.forEach(s => s.stop());
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
                 setIsSpeaking(false);
             }
          },
          onclose: () => {
            console.log('Gemini Live Connection Closed');
            setStatus(LiveStatus.DISCONNECTED);
          },
          onerror: (e: any) => {
            console.error('Gemini Live Error', e);
            setError(e.message || "Network error. Check API Key or Connection.");
            setStatus(LiveStatus.ERROR);
            cleanup();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Failed to connect:", err);
      // Propagate specific error codes
      setError(err.message || "Failed to initialize connection");
      setStatus(LiveStatus.ERROR);
      cleanup();
    }
  }, [cleanup, visualize]);

  const disconnect = useCallback(() => {
      cleanup();
      setStatus(LiveStatus.DISCONNECTED);
  }, [cleanup]);

  useEffect(() => {
      return () => cleanup();
  }, [cleanup]);

  return {
    status,
    connect,
    disconnect,
    isSpeaking,
    audioLevel,
    error,
  };
};
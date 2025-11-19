
// Utility to convert base64 string to raw bytes
export function decode(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Utility to convert raw bytes to base64 string
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decodes raw PCM data into an AudioBuffer
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert 16-bit PCM to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Downsamples input audio buffer to 16kHz and converts to Int16 PCM.
 * Gemini requires 16kHz Little Endian PCM.
 */
export function pcmTo16k(input: Float32Array, inputSampleRate: number): { data: string; mimeType: string } {
    let pcm16: Int16Array;

    if (inputSampleRate === 16000) {
        // No resampling needed
        pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            let s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
    } else {
        // Simple Linear Interpolation Downsampling
        const ratio = inputSampleRate / 16000;
        const newLength = Math.ceil(input.length / ratio);
        pcm16 = new Int16Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
            const offset = i * ratio;
            const index = Math.floor(offset);
            const nextIndex = Math.min(input.length - 1, Math.ceil(offset));
            const weight = offset - index;
            
            let val = input[index] * (1 - weight) + input[nextIndex] * weight;
            val = Math.max(-1, Math.min(1, val));
            pcm16[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
        }
    }

    return {
        data: encode(new Uint8Array(pcm16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

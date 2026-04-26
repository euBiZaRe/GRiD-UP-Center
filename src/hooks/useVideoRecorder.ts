import { useState, useEffect, useRef } from 'react';

export const useVideoRecorder = (telemetry: any) => {
    const [isRecording, setIsRecording] = useState(false);
    const [bestLapVideoUrl, setBestLapVideoUrl] = useState<string | null>(null);
    const [bestLapTime, setBestLapTime] = useState<number>(Infinity);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const currentLapRef = useRef<number>(-1);
    const bestLapTimeRef = useRef<number>(Infinity);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { frameRate: 30, width: 1280, height: 720 },
                audio: false
            });
            streamRef.current = stream;
            
            // Handle user stopping the stream manually via the browser UI
            stream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            setIsRecording(true);
            currentLapRef.current = telemetry?.lap || 0;
            startNewLap();
        } catch (err) {
            console.error("Failed to start recording:", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        setIsRecording(false);
        currentLapRef.current = -1;
    };

    const startNewLap = (lastLapTime?: number) => {
        if (!streamRef.current) return;
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            (mediaRecorderRef.current as any).lapTime = lastLapTime;
            mediaRecorderRef.current.stop();
        }

        chunksRef.current = [];
        const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
        
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async (e) => {
            const targetRecorder = e.target as any;
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const lapTime = targetRecorder.lapTime;
            
            if (lapTime && lapTime > 0 && lapTime < bestLapTimeRef.current) {
                bestLapTimeRef.current = lapTime;
                setBestLapTime(lapTime);
                
                const blobUrl = URL.createObjectURL(blob);
                setBestLapVideoUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return blobUrl;
                });

                // Save to local disk for persistence
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const fileName = `FastestLap_${telemetry.trackId}_${lapTime.toFixed(3)}.webm`;
                    const filePath = await (window as any).electron.invoke('save-video', { arrayBuffer, fileName });
                    console.log(`Video saved to disk: ${filePath}`);
                } catch (err) {
                    console.error("Failed to save video to disk:", err);
                }
            }
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
    };

    useEffect(() => {
        if (!isRecording || !telemetry) return;
        const currentLap = telemetry.lap || 0;
        
        // Initial setup
        if (currentLapRef.current === -1) {
            currentLapRef.current = currentLap;
            return;
        }

        // Lap completed!
        if (currentLap > currentLapRef.current) {
            currentLapRef.current = currentLap;
            const lastLapTime = telemetry.lap_history?.[0]?.time;
            startNewLap(lastLapTime);
        }
    }, [telemetry?.lap, isRecording]);

    return { isRecording, startRecording, stopRecording, bestLapVideoUrl, bestLapTime };
};

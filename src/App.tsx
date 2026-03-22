/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Volume2, Settings, AlertTriangle, Info, Radio } from 'lucide-react';

export default function App() {
  const [isLive, setIsLive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [volume, setVolume] = useState<number>(1);
  const [echoCancellation, setEchoCancellation] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch available audio input devices
  const getDevices = async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      setErrorMsg('마이크 접근 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.');
    }
  };

  useEffect(() => {
    getDevices();
    
    // Listen for device changes (e.g., plugging in a USB mic)
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      stopAudio();
    };
  }, []);

  // Update volume when slider changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  const startAudio = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: echoCancellation,
          noiseSuppression: echoCancellation, // Usually bundled with echo cancellation for voice
          autoGainControl: false, // Disable for purer sound/lower latency
        }
      });
      streamRef.current = stream;

      // Initialize AudioContext with lowest latency hint
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ latencyHint: 'interactive' });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      gainNodeRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      setIsLive(true);
    } catch (err) {
      console.error('Error starting audio:', err);
      setErrorMsg('오디오를 시작할 수 없습니다. 마이크가 다른 앱에서 사용 중인지 확인하세요.');
      setIsLive(false);
    }
  };

  const stopAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsLive(false);
  };

  const toggleLive = () => {
    if (isLive) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-zinc-700'}`} />
            <h1 className="text-lg font-semibold tracking-tight">라이브 마이크 모니터</h1>
          </div>
          <Radio className={`w-5 h-5 ${isLive ? 'text-red-500' : 'text-zinc-600'}`} />
        </div>

        {/* Main Controls */}
        <div className="p-6 space-y-8">
          
          {/* Device Selector */}
          <div className="space-y-3">
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Mic className="w-4 h-4" /> 입력 장치
            </label>
            <select 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 appearance-none disabled:opacity-50"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={isLive}
            >
              {devices.length === 0 ? (
                <option value="">마이크를 찾을 수 없습니다</option>
              ) : (
                devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `마이크 ${device.deviceId.substring(0, 5)}...`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Volume Control */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> 출력 볼륨
              </label>
              <span className="text-xs font-mono text-zinc-500">{Math.round(volume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.01" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-red-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Settings Toggles */}
          <div className="space-y-3">
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4" /> 오디오 설정
            </label>
            <label className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-800/50 transition-colors">
              <div className="flex flex-col">
                <span className="text-sm font-medium">하울링 방지 (Echo Cancellation)</span>
                <span className="text-xs text-zinc-500">스피커 사용 시 켜주세요. (딜레이 약간 증가)</span>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={echoCancellation}
                  onChange={(e) => setEchoCancellation(e.target.checked)}
                  disabled={isLive}
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Big Action Button */}
          <button
            onClick={toggleLive}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-200 ${
              isLive 
                ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700' 
                : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]'
            }`}
          >
            {isLive ? (
              <>
                <Square className="w-5 h-5 fill-current" /> <span>모니터링 중지</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" /> <span>라이브 마이크 시작</span>
              </>
            )}
          </button>
        </div>

        {/* Info Footer */}
        <div className="bg-zinc-950 p-5 border-t border-zinc-800 text-xs text-zinc-400 space-y-3 leading-relaxed">
          <p className="flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />
            <span>
              <strong className="text-zinc-300">딜레이(Latency) 안내:</strong> 웹 오디오 API를 사용하여 최소한의 지연 시간으로 설정되어 있습니다. 하지만 <strong>블루투스 스피커/이어폰</strong> 자체의 물리적인 전송 딜레이(약 100~300ms)는 앱에서 줄일 수 없습니다. 딜레이 없는 모니터링을 원하시면 유선 이어폰이나 기기 내장 스피커를 사용하세요.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />
            <span>
              <strong className="text-zinc-300">하울링 주의:</strong> 마이크와 스피커가 가까우면 삐- 하는 소리(피드백)가 발생할 수 있습니다. 이어폰 사용을 권장하며, 스피커 사용 시 위 설정에서 '하울링 방지'를 켜주세요.
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}

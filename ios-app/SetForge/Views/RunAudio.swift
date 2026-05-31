import AVFoundation

/// Run-mode audio cues — synthesized tones matching the web client:
/// 880 Hz short "beep" at T-3/T-2/T-1 of the rest countdown, and a 1320 Hz
/// "go" tone at zero. No bundled sound files — tones are rendered into PCM
/// buffers once and scheduled on an `AVAudioPlayerNode`.
final class RunAudio {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)!
    private var beepBuffer: AVAudioPCMBuffer?
    private var goBuffer: AVAudioPCMBuffer?
    private var started = false

    init() {
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        beepBuffer = tone(frequency: 880, duration: 0.13, decay: 14)
        goBuffer   = tone(frequency: 1320, duration: 0.60, decay: 4)
    }

    /// Activate the audio session + engine. Call from a user gesture (the
    /// Start / preview tap) so playback works under the silent switch.
    func activate() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, options: [.mixWithOthers, .duckOthers])
        try? session.setActive(true)
        if !engine.isRunning { try? engine.start() }
        if !player.isPlaying { player.play() }
        started = true
    }

    func stop() {
        player.stop()
        engine.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        started = false
    }

    func beep() { schedule(beepBuffer) }
    func go()   { schedule(goBuffer) }

    private func schedule(_ buffer: AVAudioPCMBuffer?) {
        guard let buffer else { return }
        if !started { activate() }
        if !engine.isRunning { try? engine.start() }
        if !player.isPlaying { player.play() }
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
    }

    /// One sine tone with a fast attack + exponential decay envelope.
    private func tone(frequency: Double, duration: Double, decay: Double) -> AVAudioPCMBuffer? {
        let sr = format.sampleRate
        let frames = AVAudioFrameCount(sr * duration)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return nil }
        buffer.frameLength = frames
        let samples = buffer.floatChannelData![0]
        for i in 0..<Int(frames) {
            let t = Double(i) / sr
            let attack = min(1.0, t / 0.01)
            let env = attack * exp(-t * decay)
            samples[i] = Float(sin(2 * .pi * frequency * t) * 0.35 * env)
        }
        return buffer
    }
}

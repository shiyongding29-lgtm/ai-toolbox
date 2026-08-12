import { useRef, useEffect } from 'react'

interface AudioVisualizerProps {
  stream: MediaStream | null
  width?: number
  height?: number
  barColor?: string
}

export default function AudioVisualizer({
  stream,
  width = 300,
  height = 48,
  barColor = '#1d428a',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) return

    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, width, height)
      const barWidth = (width / bufferLength) * 1.5
      const gap = (width / bufferLength) * 0.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
        gradient.addColorStop(0, barColor)
        gradient.addColorStop(1, barColor + 'aa')
        ctx.fillStyle = gradient

        ctx.beginPath()
        const cx = x + barWidth / 2
        const cy = height - barHeight / 2
        const rx = barWidth / 2
        const ry = Math.max(barHeight / 2, 1)
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.fill()

        x += barWidth + gap
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      audioCtx.close()
    }
  }, [stream, width, height, barColor])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', margin: '0 auto', borderRadius: 4 }}
      aria-label="音频波形可视化"
    />
  )
}

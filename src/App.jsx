import { useState, useRef, useCallback } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function useAudio() {
  const [falando, setFalando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const audioRef = useRef(null)

  const parar = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setFalando(false)
    setPausado(false)
    setProgresso(0)
  }, [])

  const pausarRetomar = useCallback(() => {
    if (!audioRef.current) return
    if (pausado) {
      audioRef.current.play()
      setPausado(false)
    } else {
      audioRef.current.pause()
      setPausado(true)
    }
  }, [pausado])

  const falar = useCallback(async (texto, onError) => {
    parar()
    setFalando(true)
    setPausado(false)
    setProgresso(0)

    try {
      const res = await fetch(`${API_URL}/sintetizar-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Erro ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgresso(Math.round((audio.currentTime / audio.duration) * 100))
        }
      }
      audio.onended = () => {
        setFalando(false)
        setPausado(false)
        setProgresso(100)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setFalando(false)
        setPausado(false)
        URL.revokeObjectURL(url)
      }

      await audio.play()
    } catch (err) {
      setFalando(false)
      setPausado(false)
      if (onError) onError(err.message)
    }
  }, [parar])

  return { falando, pausado, progresso, falar, pausarRetomar, parar }
}

export default function App() {
  const [imagem, setImagem] = useState(null)
  const [preview, setPreview] = useState(null)
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [erro, setErro] = useState(null)
  const inputRef = useRef()

  const { falando, pausado, progresso, falar, pausarRetomar, parar } = useAudio()

  const handleImagem = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImagem(file)
    setPreview(URL.createObjectURL(file))
    setTexto('')
    setErro(null)
    parar()
  }

  const removerImagem = () => {
    setImagem(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
    parar()
  }

  const extrairTexto = async () => {
    if (!imagem) return
    setLoading(true)
    setErro(null)
    setTexto('')
    parar()

    try {
      const form = new FormData()
      form.append('imagem', imagem)
      const res = await fetch(`${API_URL}/extrair-texto`, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Erro ${res.status}`)
      }
      const data = await res.json()
      setTexto(data.texto)
    } catch (err) {
      setErro(err.message || 'Não foi possível conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }

  const ouvir = async () => {
    if (falando) {
      pausarRetomar()
      return
    }
    setLoadingAudio(true)
    await falar(texto, (msg) => setErro(msg))
    setLoadingAudio(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-icon">🕊️</div>
        <h1>Leitor Nossa Senhora</h1>
        <p>Fotografe o texto do livro e ouça em voz alta</p>
      </header>

      <main className="app-main">

        {/* Passo 1: Foto */}
        <div className="card">
          <div className="card-title">📷 Passo 1 — Fotografe a página</div>
          <div className="upload-area">
            {preview ? (
              <div className="preview-wrapper">
                <img src={preview} alt="Página do livro" className="imagem-preview" />
                <button type="button" className="btn-remover" onClick={removerImagem}>
                  ✕ Remover foto
                </button>
              </div>
            ) : (
              <label className="btn-foto">
                📷 Tirar foto da página
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImagem}
                  hidden
                />
              </label>
            )}
          </div>

          {imagem && !texto && (
            <button
              className="btn-extrair"
              style={{ marginTop: 14 }}
              onClick={extrairTexto}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Lendo texto...</> : '✨ Ler texto da foto'}
            </button>
          )}
        </div>

        {erro && <div className="alert erro">{erro}</div>}

        {/* Passo 2: Texto + Áudio */}
        {texto && (
          <div className="card">
            <div className="card-title">🔊 Passo 2 — Ouça o texto</div>
            <div className="texto-box">
              <div className="texto-conteudo">{texto}</div>

              <div className="audio-controles">
                {falando && (
                  <div className="progresso-bar">
                    <div className="progresso-fill" style={{ width: `${progresso}%` }} />
                  </div>
                )}

                <div className="audio-btns">
                  <button
                    className={`btn-ouvir${pausado ? ' pausado' : ''}`}
                    onClick={ouvir}
                    disabled={loadingAudio}
                  >
                    {loadingAudio
                      ? <><span className="spinner" /> Gerando áudio...</>
                      : !falando ? '▶ Ouvir'
                      : pausado ? '▶ Continuar'
                      : '⏸ Pausar'}
                  </button>
                  {falando && (
                    <button className="btn-parar" onClick={parar}>⏹</button>
                  )}
                </div>
              </div>

              <button
                className="btn-extrair"
                style={{ background: '#64748b' }}
                onClick={() => { setTexto(''); removerImagem() }}
              >
                📷 Nova página
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Powered by Claude AI + ElevenLabs · Com amor à Nossa Senhora</p>
      </footer>
    </div>
  )
}

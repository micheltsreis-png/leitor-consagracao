import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function useSpeech() {
  const [falando, setFalando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const utterRef = useRef(null)
  const textoRef = useRef('')
  const posRef = useRef(0)
  const velocidadeRef = useRef(1)

  const parar = useCallback(() => {
    window.speechSynthesis.cancel()
    setFalando(false)
    setPausado(false)
    setProgresso(0)
    posRef.current = 0
  }, [])

  const falar = useCallback((texto, velocidade = 1) => {
    window.speechSynthesis.cancel()
    textoRef.current = texto
    velocidadeRef.current = velocidade
    posRef.current = 0

    const utter = new SpeechSynthesisUtterance(texto)
    utter.lang = 'pt-BR'
    utter.rate = velocidade

    utter.onboundary = (e) => {
      if (e.name === 'word') {
        posRef.current = e.charIndex
        setProgresso(Math.round((e.charIndex / texto.length) * 100))
      }
    }

    utter.onend = () => {
      setFalando(false)
      setPausado(false)
      setProgresso(100)
    }

    utter.onerror = () => {
      setFalando(false)
      setPausado(false)
    }

    utterRef.current = utter
    window.speechSynthesis.speak(utter)
    setFalando(true)
    setPausado(false)
  }, [])

  const pausarRetomar = useCallback(() => {
    if (pausado) {
      window.speechSynthesis.resume()
      setPausado(false)
    } else {
      window.speechSynthesis.pause()
      setPausado(true)
    }
  }, [pausado])

  useEffect(() => () => window.speechSynthesis.cancel(), [])

  return { falando, pausado, progresso, falar, pausarRetomar, parar }
}

export default function App() {
  const [imagem, setImagem] = useState(null)
  const [preview, setPreview] = useState(null)
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const [velocidade, setVelocidade] = useState(0.9)
  const inputRef = useRef()

  const { falando, pausado, progresso, falar, pausarRetomar, parar } = useSpeech()

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

  const ouvir = () => {
    if (falando) {
      pausarRetomar()
    } else {
      falar(texto, velocidade)
    }
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
                <div className="velocidade-row">
                  <span>🐢</span>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={velocidade}
                    onChange={(e) => setVelocidade(parseFloat(e.target.value))}
                    disabled={falando}
                  />
                  <span>🐇</span>
                  <span style={{ minWidth: 36, textAlign: 'right', fontSize: '0.85rem' }}>
                    {velocidade.toFixed(1)}x
                  </span>
                </div>

                {falando && (
                  <div className="progresso-bar">
                    <div className="progresso-fill" style={{ width: `${progresso}%` }} />
                  </div>
                )}

                <div className="audio-btns">
                  <button className={`btn-ouvir${pausado ? ' pausado' : ''}`} onClick={ouvir}>
                    {!falando ? '▶ Ouvir' : pausado ? '▶ Continuar' : '⏸ Pausar'}
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
        <p>Powered by Claude AI · Com amor à Nossa Senhora</p>
      </footer>
    </div>
  )
}

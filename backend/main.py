import os
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic
from elevenlabs import ElevenLabs

app = FastAPI(title="Leitor Nossa Senhora")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
    max_age=600,
)

client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
eleven = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

# Voz Rachel — feminina, clara, disponível em todos os planos
VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

SYSTEM_EXTRAIR = """Você é um assistente especializado em extrair texto de imagens de livros religiosos.

Ao receber uma imagem:
1. Extraia TODO o texto visível na imagem, palavra por palavra
2. Preserve parágrafos e quebras de linha naturais
3. Corrija erros óbvios de digitação ou impressão quando necessário
4. Ignore números de página, cabeçalhos e rodapés irrelevantes
5. Se o texto estiver parcialmente ilegível, escreva [ilegível] nessa parte

Retorne APENAS o texto extraído, sem comentários ou explicações."""


@app.get("/")
async def health():
    return {"status": "ok", "app": "Leitor Nossa Senhora"}


@app.post("/extrair-texto")
async def extrair_texto(imagem: UploadFile = File(...)):
    """Extrai texto de uma imagem de página de livro."""
    try:
        conteudo = await imagem.read()
        imagem_b64 = base64.standard_b64encode(conteudo).decode("utf-8")
        media_type = imagem.content_type or "image/jpeg"

        resposta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_EXTRAIR,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": imagem_b64},
                    },
                    {"type": "text", "text": "Extraia todo o texto desta página."},
                ],
            }],
        )

        texto = resposta.content[0].text
        return {"texto": texto}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TextoAudioRequest(BaseModel):
    texto: str


@app.post("/sintetizar-audio")
async def sintetizar_audio(req: TextoAudioRequest):
    """Converte texto em áudio usando ElevenLabs."""
    if not req.texto.strip():
        raise HTTPException(status_code=400, detail="Texto vazio.")
    try:
        audio = eleven.text_to_speech.convert(
            voice_id=VOICE_ID,
            text=req.texto.strip(),
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        audio_bytes = b"".join(audio)
        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=audio.mp3"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

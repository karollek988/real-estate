# ---- Stage 1: the translation model ------------------------------------------------------------------
# Opus-MT Swedish -> English (Helsinki-NLP, Apache-2.0), converted to CTranslate2 (MIT) with int8 weights, ~75 MB.
# PyTorch and transformers are only needed for the conversion; they stay in this stage and never reach the image
# that runs. api/translation.py uses the result for POST /api/translate (the site's articles and map listings in
# the reader's language). Another language = another model converted into /models/<pair> and a line in
# api/translation.py MODEL_FOLDERS.
# Both stages use the official Python image from AWS's public mirror, not from Docker Hub. Railway's builders share
# addresses, and Docker Hub answered "429 Too Many Requests" when they asked for the image's metadata, which failed
# the build before it began (2026-10-09, two deploys). It is the same image: the mirror's digest for
# python:3.13-slim equals Docker Hub's.
FROM public.ecr.aws/docker/library/python:3.13-slim AS translation-model

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir transformers ctranslate2 sentencepiece

# Pinned, so a rebuild never silently picks up a changed model.
ARG OPUS_MT_SV_EN_REVISION=202cf6240046bd8b6d08c207ee751ffd630d7ba8
RUN ct2-transformers-converter \
    --model Helsinki-NLP/opus-mt-sv-en --revision "${OPUS_MT_SV_EN_REVISION}" \
    --output_dir /models/sv-en --quantization int8 --copy_files source.spm target.spm

# ---- Stage 2: the engine -----------------------------------------------------------------------------
FROM public.ecr.aws/docker/library/python:3.13-slim

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libx11-xcb1 libasound2 libdbus-glib-1-2 \
    tesseract-ocr tesseract-ocr-swe tesseract-ocr-eng \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r api/requirements.txt
RUN python -m camoufox fetch

COPY --from=translation-model /models /models
ENV TRANSLATION_MODELS_DIR=/models

WORKDIR /app/api
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]

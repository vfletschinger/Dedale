FROM ivangabriele/tauri:debian-bookworm-22

LABEL maintainer="CRS T5 Team"
LABEL description="Image CI pour Dedale"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Cross-compilation Windows
    nsis \
    lld \
    llvm \
    clang \
    # Tests E2E headless
    xvfb \
    && rm -rf /var/lib/apt/lists/*

RUN rustup component add rustfmt clippy \
    && rustup target add x86_64-pc-windows-msvc \
    && cargo install --locked cargo-xwin

RUN echo "=== Vérification ===" && \
    node --version && \
    rustc --version && \
    cargo clippy --version && \
    which cargo-xwin && \
    makensis -VERSION && \
    echo "=== OK ==="

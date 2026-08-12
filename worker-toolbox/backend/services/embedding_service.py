"""
向量嵌入服务 — 文本转向量，FAISS 搜索。
注意：首次使用需下载模型，约 1.3GB。
"""

import os
import json
from typing import Optional
import numpy as np

from backend.config import config


class EmbeddingService:
    """文本嵌入 + FAISS 向量搜索。"""

    def __init__(self):
        self._model = None
        self._index = None
        self._chunks: list[dict] = []  # [{id, text, doc_name}]
        self._index_path = os.path.join(config.knowledge_base_dir, "faiss.index")
        self._chunks_path = os.path.join(config.knowledge_base_dir, "chunks.json")

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            print(f"加载嵌入模型: {config.embedding_model} ...")
            self._model = SentenceTransformer(config.embedding_model)
            print("嵌入模型就绪。")
        return self._model

    def _ensure_index_loaded(self):
        if self._index is not None:
            return
        try:
            import faiss
            if os.path.exists(self._index_path):
                self._index = faiss.read_index(self._index_path)
                with open(self._chunks_path, "r") as f:
                    self._chunks = json.load(f)
            else:
                self._index = faiss.IndexFlatL2(1024)  # BGE-large embedding dim
                self._chunks = []
        except ImportError:
            raise ImportError("请安装 faiss-cpu: pip install faiss-cpu")

    def add_document(self, text: str, doc_name: str, chunk_size: int = 500):
        """将文档分块并添加到知识库。"""
        self._ensure_index_loaded()

        # 分块
        chunks = []
        for i in range(0, len(text), chunk_size - 50):
            chunk_text = text[i:i + chunk_size]
            if len(chunk_text) < 50:
                continue
            chunks.append(chunk_text)

        if not chunks:
            return 0

        # 向量化
        embeddings = self.model.encode(chunks, normalize_embeddings=True)

        # 加入索引
        self._index.add(np.array(embeddings, dtype=np.float32))

        # 记录 chunks
        for j, chunk_text in enumerate(chunks):
            self._chunks.append({
                "id": len(self._chunks),
                "text": chunk_text,
                "doc_name": doc_name,
            })

        self._save()
        return len(chunks)

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """搜索最相关的文档片段。"""
        self._ensure_index_loaded()
        if self._index.ntotal == 0:
            return []

        query_vec = self.model.encode([query], normalize_embeddings=True)
        distances, indices = self._index.search(np.array(query_vec, dtype=np.float32), top_k)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self._chunks):
                continue
            results.append({
                **self._chunks[idx],
                "score": float(1 - dist),  # 余弦相似度
            })
        return results

    def list_documents(self) -> list[dict]:
        """列出知识库中的文档。"""
        self._ensure_index_loaded()
        doc_names = list(set(c["doc_name"] for c in self._chunks))
        return [{"name": name, "chunks": sum(1 for c in self._chunks if c["doc_name"] == name)}
                for name in doc_names]

    def _save(self):
        import faiss
        os.makedirs(config.knowledge_base_dir, exist_ok=True)
        faiss.write_index(self._index, self._index_path)
        with open(self._chunks_path, "w") as f:
            json.dump(self._chunks, f, ensure_ascii=False)

    @property
    def is_ready(self) -> bool:
        self._ensure_index_loaded()
        return self._index.ntotal > 0


# 全局单例
embedding_service = EmbeddingService()

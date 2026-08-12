"""Multi-Tool Detector — 判断用户是否需要多步骤工作流。二分类：single_tool vs multi_tool"""
import csv
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification, get_scheduler
from torch.optim import AdamW
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

CSV_PATH = 'training_data_multitool.csv'
LABELS = ['single_tool', 'multi_tool']

# 读取数据
texts, labels = [], []
with open(CSV_PATH, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        texts.append(row['text'].strip())
        labels.append(LABELS.index(row['label'].strip()))

from collections import Counter
print(f'数据: {len(texts)} 条')
for lbl, cnt in Counter(labels).items():
    print(f'  {LABELS[lbl]}: {cnt} 条')

train_texts, test_texts, train_labels, test_labels = train_test_split(
    texts, labels, test_size=0.2, random_state=42, stratify=labels
)
print(f'训练: {len(train_texts)}  |  测试: {len(test_texts)}')

# Tokenizer + 模型
TOKENIZER = DistilBertTokenizer.from_pretrained('distilbert-base-multilingual-cased')

class MTDataset(Dataset):
    def __init__(self, texts, labels):
        self.enc = TOKENIZER(texts, truncation=True, padding=True, max_length=64, return_tensors='pt')
        self.labels = torch.tensor(labels)
    def __len__(self): return len(self.labels)
    def __getitem__(self, i): return {'input_ids': self.enc['input_ids'][i], 'attention_mask': self.enc['attention_mask'][i], 'labels': self.labels[i]}

train_loader = DataLoader(MTDataset(train_texts, train_labels), batch_size=8, shuffle=True)
test_loader = DataLoader(MTDataset(test_texts, test_labels), batch_size=8)

MODEL = DistilBertForSequenceClassification.from_pretrained('distilbert-base-multilingual-cased', num_labels=2)
DEVICE = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
MODEL.to(DEVICE)

OPTIMIZER = AdamW(MODEL.parameters(), lr=5e-5)
EPOCHS = 8
SCHEDULER = get_scheduler('linear', optimizer=OPTIMIZER, num_warmup_steps=len(train_loader), num_training_steps=EPOCHS * len(train_loader))
print(f'设备: {DEVICE}  |  训练 {EPOCHS} 轮')

MODEL.train()
for epoch in range(EPOCHS):
    total_loss = 0
    for batch in train_loader:
        batch = {k: v.to(DEVICE) for k, v in batch.items()}
        loss = MODEL(**batch).loss
        loss.backward(); OPTIMIZER.step(); SCHEDULER.step(); OPTIMIZER.zero_grad()
        total_loss += loss.item()
    print(f'Epoch {epoch+1}/{EPOCHS}  Loss: {total_loss/len(train_loader):.4f}')

MODEL.eval()
preds, trues = [], []
with torch.no_grad():
    for batch in test_loader:
        batch = {k: v.to(DEVICE) for k, v in batch.items()}
        p = torch.argmax(MODEL(**batch).logits, dim=-1)
        preds.extend(p.cpu().numpy()); trues.extend(batch['labels'].cpu().numpy())

print(f'\n准确率: {accuracy_score(trues, preds):.2%}')
print(classification_report(trues, preds, target_names=LABELS))

SAVE = '/Users/shijingying/my-ml-project/models/multitool_classifier'
MODEL.save_pretrained(SAVE); TOKENIZER.save_pretrained(SAVE)
print(f'已保存: {SAVE}')

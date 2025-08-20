# Imagens dos Tipos de Conjunto de Veículos

## Visão Geral
Criei 7 ilustrações técnicas em SVG que mostram cada tipo de conjunto de veículos do sistema AET. Cada imagem é profissional, detalhada e mostra exatamente a configuração de eixos.

## Características das Imagens

### 🎨 Design Técnico
- **Formato**: SVG (vetorial, escalável)
- **Dimensões**: 400x120px (450x120px para rodotrem)
- **Cores**: Esquema profissional com códigos de cores consistentes
- **Legibilidade**: Texto claro em português brasileiro

### 🚛 Componentes Identificados
- **Azul**: Cavalo mecânico/caminhão
- **Verde**: Primeira carreta
- **Laranja**: Segunda carreta  
- **Roxo**: Dolly
- **Laranja especial**: Prancha/reboque

### 📊 Informações Mostradas
- Número exato de eixos por componente
- Total de eixos por conjunto
- Conexões entre veículos
- Labels explicativos
- Indicador de flexibilidade (prancha/romeu e julieta)

## Lista de Imagens Criadas

### 1. Bitrem 6 Eixos (`bitrain-6-axles.svg`)
- **Cavalo**: 2 eixos (azul)
- **1ª Carreta**: 2 eixos (verde)
- **2ª Carreta**: 2 eixos (laranja)
- **Total**: 6 eixos
- **Validação**: Rígida

### 2. Bitrem 7 Eixos (`bitrain-7-axles.svg`)
- **Cavalo**: 3 eixos (azul)
- **1ª Carreta**: 2 eixos (verde)
- **2ª Carreta**: 2 eixos (laranja)
- **Total**: 7 eixos
- **Validação**: Rígida

### 3. Bitrem 9 Eixos (`bitrain-9-axles.svg`)
- **Cavalo**: 3 eixos (azul)
- **1ª Carreta**: 3 eixos (verde)
- **2ª Carreta**: 3 eixos (laranja)
- **Total**: 9 eixos
- **Validação**: Rígida

### 4. Rodotrem 7 Eixos (`roadtrain-7-axles.svg`)
- **Cavalo**: 2 eixos (azul)
- **1ª Carreta**: 2 eixos (verde)
- **Dolly**: 1 eixo (roxo)
- **2ª Carreta**: 2 eixos (laranja)
- **Total**: 7 eixos
- **Validação**: Rígida

### 5. Rodotrem 9 Eixos (`roadtrain-9-axles.svg`)
- **Cavalo**: 3 eixos (azul)
- **1ª Carreta**: 3 eixos (verde)
- **Dolly**: 0 eixos (roxo, apenas conexão)
- **2ª Carreta**: 3 eixos (laranja)
- **Total**: 9 eixos
- **Validação**: Rígida

### 6. Prancha (`flatbed.svg`)
- **Cavalo**: Eixos variáveis (azul)
- **Prancha**: Eixos flexíveis (laranja com padrão)
- **Total**: Flexível
- **Validação**: Flexível
- **Indicador**: "Eixos Flexíveis" (amarelo)

### 7. Romeu e Julieta (`romeo-juliet.svg`)
- **Caminhão (Romeu)**: Eixos variáveis (azul + verde)
- **Reboque (Julieta)**: Eixos flexíveis (laranja)
- **Total**: Flexível
- **Validação**: Flexível
- **Indicador**: "Eixos Flexíveis" (amarelo)

## Como Usar no Sistema

### 1. Interface Administrativa
As imagens aparecem automaticamente em:
- Formulário de criação de licenças
- Lista de tipos de conjunto
- Módulo administrativo de tipos

### 2. Integração com Banco
Para usar as imagens, adicione o campo `icon_path` na tabela:

```sql
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/bitrain-6-axles.svg' WHERE id = 'bitrain_6_axles';
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/bitrain-7-axles.svg' WHERE id = 'bitrain_7_axles';
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/bitrain-9-axles.svg' WHERE id = 'bitrain_9_axles';
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/roadtrain-7-axles.svg' WHERE id = 'roadtrain_7_axles';
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/roadtrain-9-axles.svg' WHERE id = 'roadtrain_9_axles';
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/flatbed.svg' WHERE id = 'flatbed';
UPDATE vehicle_set_types SET icon_path = '/src/assets/vehicle-sets/romeo-juliet.svg' WHERE id = 'romeo_juliet';
```

### 3. Referência no Frontend
As imagens podem ser importadas:

```typescript
import bitrainSixAxles from '@assets/vehicle-sets/bitrain-6-axles.svg';
import bitrainSevenAxles from '@assets/vehicle-sets/bitrain-7-axles.svg';
// ... etc
```

## Características Técnicas

### ✅ Vantagens das Imagens SVG
- **Escaláveis**: Mantém qualidade em qualquer tamanho
- **Leves**: Arquivo pequeno, carregamento rápido
- **Editáveis**: Podem ser modificadas facilmente
- **Responsivas**: Adaptam-se a diferentes telas
- **Acessíveis**: Suportam texto alternativo

### 🎯 Uso Recomendado
- **Formulários**: Seleção visual de tipos
- **Documentação**: Explicação técnica
- **Relatórios**: Identificação rápida
- **Treinamento**: Material educativo
- **Mobile**: Interface amigável

## Localização dos Arquivos
```
client/src/assets/vehicle-sets/
├── bitrain-6-axles.svg
├── bitrain-7-axles.svg
├── bitrain-9-axles.svg
├── roadtrain-7-axles.svg
├── roadtrain-9-axles.svg
├── flatbed.svg
└── romeo-juliet.svg
```

As imagens estão prontas para uso imediato no sistema! 🚛✨
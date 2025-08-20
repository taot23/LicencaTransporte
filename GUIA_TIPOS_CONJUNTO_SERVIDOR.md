# Configuração dos Tipos de Conjunto no Servidor Próprio

## 1. Estrutura da Tabela no Banco

Primeiro, você precisa da tabela `vehicle_set_types` criada no seu PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS vehicle_set_types (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  label VARCHAR NOT NULL,
  description TEXT,
  axle_configuration JSONB NOT NULL,
  dimension_limits JSONB,
  vehicle_types JSONB NOT NULL,
  icon_path VARCHAR,
  image_url VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 2. Dados para Inserir (SQL Pronto)

Execute estes comandos SQL no seu banco PostgreSQL para cadastrar todos os tipos de conjunto padrão:

```sql
-- 1. BITREM 6 EIXOS
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'bitrain_6_axles',
  'bitrain_6_axles', 
  'Bitrem 6 eixos',
  'Composição bitrem com 6 eixos totais',
  '{"tractorAxles": 2, "firstTrailerAxles": 2, "secondTrailerAxles": 2, "totalAxles": 6, "requiresDolly": false, "isFlexible": false}',
  '{"minLength": 19.8, "maxLength": 30.0, "maxWidth": 2.6, "maxHeight": 4.4}',
  '{"tractor": ["tractor_unit"], "firstTrailer": ["semi_trailer"], "secondTrailer": ["semi_trailer"]}',
  true, NOW(), NOW()
);

-- 2. BITREM 7 EIXOS
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'bitrain_7_axles',
  'bitrain_7_axles', 
  'Bitrem 7 eixos',
  'Composição bitrem com 7 eixos totais',
  '{"tractorAxles": 3, "firstTrailerAxles": 2, "secondTrailerAxles": 2, "totalAxles": 7, "requiresDolly": false, "isFlexible": false}',
  '{"minLength": 19.8, "maxLength": 30.0, "maxWidth": 2.6, "maxHeight": 4.4}',
  '{"tractor": ["tractor_unit"], "firstTrailer": ["semi_trailer"], "secondTrailer": ["semi_trailer"]}',
  true, NOW(), NOW()
);

-- 3. BITREM 9 EIXOS
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'bitrain_9_axles',
  'bitrain_9_axles', 
  'Bitrem 9 eixos',
  'Composição bitrem com 9 eixos totais',
  '{"tractorAxles": 3, "firstTrailerAxles": 3, "secondTrailerAxles": 3, "totalAxles": 9, "requiresDolly": false, "isFlexible": false}',
  '{"minLength": 19.8, "maxLength": 30.0, "maxWidth": 2.6, "maxHeight": 4.4}',
  '{"tractor": ["tractor_unit"], "firstTrailer": ["semi_trailer"], "secondTrailer": ["semi_trailer"]}',
  true, NOW(), NOW()
);

-- 4. RODOTREM 7 EIXOS
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'roadtrain_7_axles',
  'roadtrain_7_axles', 
  'Rodotrem 7 eixos',
  'Composição rodotrem com 7 eixos totais',
  '{"tractorAxles": 2, "firstTrailerAxles": 2, "secondTrailerAxles": 2, "dollyAxles": 1, "totalAxles": 7, "requiresDolly": true, "isFlexible": false}',
  '{"minLength": 19.8, "maxLength": 30.0, "maxWidth": 2.6, "maxHeight": 4.4}',
  '{"tractor": ["tractor_unit"], "firstTrailer": ["semi_trailer"], "secondTrailer": ["semi_trailer"], "dolly": ["dolly"]}',
  true, NOW(), NOW()
);

-- 5. RODOTREM 9 EIXOS
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'roadtrain_9_axles',
  'roadtrain_9_axles', 
  'Rodotrem 9 eixos',
  'Composição rodotrem com 9 eixos totais',
  '{"tractorAxles": 3, "firstTrailerAxles": 3, "secondTrailerAxles": 3, "dollyAxles": 0, "totalAxles": 9, "requiresDolly": true, "isFlexible": false}',
  '{"minLength": 19.8, "maxLength": 30.0, "maxWidth": 2.6, "maxHeight": 4.4}',
  '{"tractor": ["tractor_unit"], "firstTrailer": ["semi_trailer"], "secondTrailer": ["semi_trailer"], "dolly": ["dolly"]}',
  true, NOW(), NOW()
);

-- 6. PRANCHA (FLEXÍVEL)
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'flatbed',
  'flatbed', 
  'Prancha',
  'Composição com prancha (validação flexível)',
  '{"tractorAxles": 0, "firstTrailerAxles": 0, "secondTrailerAxles": 0, "totalAxles": 0, "requiresDolly": false, "isFlexible": true}',
  '{"minLength": 0, "maxLength": 50.0, "maxWidth": 5.0, "maxHeight": 5.0}',
  '{"tractor": ["tractor_unit"], "firstTrailer": ["flatbed"]}',
  true, NOW(), NOW()
);

-- 7. ROMEU E JULIETA (FLEXÍVEL)
INSERT INTO vehicle_set_types (
  id, name, label, description, 
  axle_configuration, dimension_limits, vehicle_types, 
  is_active, created_at, updated_at
) VALUES (
  'romeo_juliet',
  'romeo_juliet', 
  'Romeu e Julieta',
  'Composição Romeu e Julieta (validação flexível)',
  '{"tractorAxles": 0, "firstTrailerAxles": 0, "secondTrailerAxles": 0, "totalAxles": 0, "requiresDolly": false, "isFlexible": true}',
  '{"minLength": 0, "maxLength": 50.0, "maxWidth": 5.0, "maxHeight": 5.0}',
  '{"tractor": ["truck"], "firstTrailer": ["trailer"]}',
  true, NOW(), NOW()
);
```

## 3. Verificar se foi cadastrado corretamente

Após executar os INSERTs, verifique se foram inseridos:

```sql
SELECT id, name, label, is_active FROM vehicle_set_types ORDER BY id;
```

## 4. Como o Sistema Funciona

O sistema híbrido funciona assim:

1. **Tipos Padrão**: 6 tipos definidos no código (arquivo `shared/vehicle-set-types.ts`)
2. **Tipos Personalizados**: Carregados do banco via API `/api/admin/vehicle-set-types`
3. **Merge Automático**: O frontend combina os dois automaticamente

## 5. Para Criar Tipos Personalizados

Você pode criar novos tipos pela interface administrativa em:
- **Menu**: Admin → Tipos de Conjunto
- **Rota**: `/admin/vehicle-set-types`

Ou inserir direto no banco seguindo o mesmo padrão JSON dos exemplos acima.

## 6. Estrutura dos Campos JSON

### axle_configuration:
```json
{
  "tractorAxles": 2,        // Eixos do cavalo
  "firstTrailerAxles": 2,   // Eixos da 1ª carreta
  "secondTrailerAxles": 2,  // Eixos da 2ª carreta
  "dollyAxles": 1,          // Eixos do dolly (se necessário)
  "totalAxles": 7,          // Total de eixos
  "requiresDolly": true,    // Se precisa de dolly
  "isFlexible": false       // Se ignora validação rígida de eixos
}
```

### dimension_limits:
```json
{
  "minLength": 19.8,   // Comprimento mínimo (metros)
  "maxLength": 30.0,   // Comprimento máximo (metros)  
  "maxWidth": 2.6,     // Largura máxima (metros)
  "maxHeight": 4.4     // Altura máxima (metros)
}
```

### vehicle_types:
```json
{
  "tractor": ["tractor_unit"],           // Tipos aceitos para cavalo
  "firstTrailer": ["semi_trailer"],      // Tipos aceitos para 1ª carreta
  "secondTrailer": ["semi_trailer"],     // Tipos aceitos para 2ª carreta
  "dolly": ["dolly"]                     // Tipos aceitos para dolly
}
```

## 7. Imagens dos Tipos de Conjunto

O sistema inclui ilustrações SVG técnicas para cada tipo:

- `bitrain-6-axles.svg` - Bitrem 6 eixos
- `bitrain-7-axles.svg` - Bitrem 7 eixos  
- `bitrain-9-axles.svg` - Bitrem 9 eixos
- `roadtrain-7-axles.svg` - Rodotrem 7 eixos
- `roadtrain-9-axles.svg` - Rodotrem 9 eixos
- `flatbed.svg` - Prancha (flexível)
- `romeo-juliet.svg` - Romeu e Julieta (flexível)

As imagens mostram:
- Configuração exata de eixos
- Cores diferenciadas por componente
- Indicadores de total de eixos
- Labels explicativos em português

## 8. Estados Suportados

O sistema funciona para todos os estados brasileiros exceto **MA (Maranhão)**.

Estados disponíveis: AC, AL, AP, AM, BA, CE, DF, ES, GO, MG, MS, MT, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SE, SP, TO, além de DNIT, ANTT, PRF.
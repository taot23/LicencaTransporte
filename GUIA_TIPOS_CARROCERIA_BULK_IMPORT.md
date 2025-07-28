# Guia: Tipos de Carroceria na Importação em Massa

## Visão Geral
O sistema de importação em massa agora suporta todos os 18 tipos de carroceria oficiais do sistema AET.

## Formato do CSV Atualizado

### Colunas Obrigatórias
- `placa`: Placa do veículo (mínimo 6 caracteres)
- `tipo_veiculo`: Tipo do veículo
- `marca`: Marca do veículo
- `modelo`: Modelo do veículo
- `ano_fabricacao`: Ano de fabricação
- `ano_crlv`: Ano do CRLV
- `renavam`: Número do RENAVAM
- `cmt`: Capacidade Máxima de Tração (CMT)
- `tara`: Tara do veículo
- `transportador_cpf_cnpj`: CPF/CNPJ do transportador

### Colunas Opcionais
- `tipo_carroceria`: Tipo de carroceria (opcional)
- `eixo`: Número de eixos (padrão: 2)

## Tipos de Carroceria Aceitos

| Tipo no CSV | Valor no Sistema | Aplicável Para |
|-------------|------------------|----------------|
| Aberta | open | Semirreboques/Reboques |
| Basculante | dump | Semirreboques/Reboques |
| Boiadeiro | cattle | Semirreboques/Reboques |
| Cana de Açúcar | sugar_cane | Semirreboques/Reboques |
| Container | container | Semirreboques/Reboques |
| Fechada | closed | Semirreboques/Reboques |
| Mecânico operacional | mechanical_operational | Semirreboques/Reboques |
| Plataforma | platform | Semirreboques/Reboques |
| Prancha | flatbed | Semirreboques/Reboques |
| Prancha - Cegonha | car_carrier | Semirreboques/Reboques |
| Prancha Extensiva | extendable_flatbed | Semirreboques/Reboques |
| Rodo Caçamba | dump_truck | Semirreboques/Reboques |
| Rollon Rollof | roll_on_roll_off | Semirreboques/Reboques |
| SILO | silo | Semirreboques/Reboques |
| Subestação Móvel | mobile_substation | Semirreboques/Reboques |
| Tanque | tank | Semirreboques/Reboques |
| Tran Toras | log_carrier | Semirreboques/Reboques |
| VTAV | vtav | Semirreboques/Reboques |

## Comportamento do Sistema

### Quando tipo_carroceria é especificado:
- Sistema usa o tipo informado se válido
- Valida se o tipo é compatível com o tipo de veículo

### Quando tipo_carroceria não é especificado:
- **Unidade Tratora**: Sem carroceria (null)
- **Semirreboque/Reboque**: Container (padrão)
- **Prancha**: Prancha (flatbed)
- **Outros**: Fechada (closed)

## Exemplo de CSV

```csv
placa;tipo_veiculo;tipo_carroceria;marca;modelo;ano_fabricacao;ano_crlv;renavam;cmt;tara;eixo;transportador_cpf_cnpj
ABC1D23;Unidade Tratora (Cavalo);;Scania;R440;2018;2024;12345678901;45000;10500;5;12345678000199
DEF4E56;Semirreboque;Container;Randon;RK-430SR;2019;2024;12345678902;25000;8500;3;12345678000199
GHI7J89;Reboque;Prancha;Facchini;FB-2SR;2020;2024;12345678903;30000;9000;3;12345678000199
JKL0M12;Semirreboque;Tanque;Guerra;GT-2SR;2021;2024;12345678904;28000;8200;3;12345678000199
```

## Validações
- Tipos de carroceria são validados contra a lista oficial
- Tipos inválidos geram erro com sugestão de tipos válidos
- Sistema aplica padrões automáticos para veículos sem tipo especificado

## Logs de Debug
O sistema registra logs detalhados durante a importação:
- Tipo de carroceria detectado no CSV
- Mapeamento aplicado (especificado ou padrão)
- Valor final usado no banco de dados
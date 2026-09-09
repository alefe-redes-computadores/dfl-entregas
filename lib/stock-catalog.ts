// lib/stock-catalog.ts
import type { StockProduct, StockProductPresentation, StockSupplier } from '@/types';

const now = '2026-09-09T00:00:00.000Z';
const p = (id: string, label: string, conversion_quantity: number, purchase_unit: StockProductPresentation['purchase_unit'] = 'un'): StockProductPresentation => ({ id, label, purchase_unit, conversion_quantity, active: true });
const product = (id: string, name: string, category: string, unit: StockProduct['unit'], icon: string, color: string, presentations: StockProductPresentation[]): StockProduct => ({ id: `catalog-${id}`, name, category, unit, icon, color, presentations, current_quantity: 0, minimum_quantity: 0, active: true, created_at: now, updated_at: now });

export const INITIAL_STOCK_SUPPLIERS: StockSupplier[] = [
  ['atacadao', 'Atacadão', 'supermercado'], ['bernardao', 'Bernardão', 'supermercado'], ['mart-minas', 'Mart Minas', 'supermercado'],
  ['uniao', 'União', 'embalagens'], ['plaspel', 'Plaspel', 'embalagens'], ['dipel', 'Dipel', 'embalagens'],
  ['master-chef', 'Master Chef', 'acougue'], ['meu-mercado', 'Meu Mercado', 'acougue'], ['supergasbras', 'Supergasbras', 'gas'],
].map(([id, name, type]) => ({ id: `supplier-${id}`, name, type: type as StockSupplier['type'], active: true, created_at: now, updated_at: now }));

export const INITIAL_STOCK_PRODUCTS: StockProduct[] = [
  product('carne-moida','Carne moída','Açougue','kg','beef','red',[p('peso','Peso fracionado',1,'kg')]),
  product('file-frango','Filé de frango','Açougue','kg','drumstick','red',[p('peso','Peso fracionado',1,'kg'),p('bandeja-1kg','Bandeja 1 kg',1)]),
  product('hamburguer-artesanal-100g','Hambúrguer artesanal 100 g','Açougue','un','beef','red',[p('un','Unidade',1)]),
  product('hamburguer-36g','Hambúrguer 36 g','Açougue','un','beef','red',[p('cx-36','Caixa com 36',36,'cx')]),
  product('presunto','Presunto / apresuntado','Frios','kg','sandwich','sky',[p('peso','Peso fracionado',1,'kg')]),
  product('mussarela','Mussarela','Frios','kg','cheese','sky',[p('peso','Peso fracionado',1,'kg')]),
  product('salsicha','Salsicha','Açougue','kg','beef','red',[p('peso','Peso fracionado',1,'kg'),p('pct-3kg','Pacote 3 kg',3,'pct'),p('pct-5kg','Pacote 5 kg',5,'pct')]),
  product('bacon','Bacon','Açougue','kg','beef','red',[p('pct-750g','Pacote 750 g',0.75,'pct'),p('pct-1kg','Pacote 1 kg',1,'pct')]),
  product('gas-glp-13kg','Gás de cozinha — GLP 13 kg','Gás','un','flame','blue',[p('botijao','Botijão 13 kg',1)]),
  product('papel-kraft','Papel kraft','Embalagens','un','package','amber',[p('pct-100','Pacote com 100',100,'pct'),p('pct-500','Pacote com 500',500,'pct')]),
  product('hamburgueira-th001','Hamburgueira TH001','Embalagens','un','package','amber',[p('pct-100','Pacote com 100',100,'pct')]),
  product('hamburgueira-th002','Hamburgueira TH002','Embalagens','un','package','amber',[p('pct-100','Pacote com 100',100,'pct')]),
  product('sacola-38x48','Sacola plástica 38 × 48','Embalagens','un','shopping-bag','amber',[p('pct-100','Pacote com 100',100,'pct')]),
  product('sacola-30x40','Sacola plástica 30 × 40','Embalagens','un','shopping-bag','amber',[p('pct-100','Pacote com 100',100,'pct')]),
  product('saco-hamburguer','Saco plástico para hambúrguer','Embalagens','un','package','amber',[p('pct-500','Pacote com 500',500,'pct')]),
  product('copo-30ml-tampa','Copo 30 ml com tampa','Embalagens','un','cup-soda','amber',[p('pct-20','Pacote com 20',20,'pct'),p('cx-700','Caixa com 700',700,'cx')]),
  product('copo-200ml','Copo descartável 200 ml','Embalagens','un','cup-soda','amber',[p('pct-100','Pacote com 100',100,'pct')]),
  product('luva','Luva descartável','Embalagens','un','hand','amber',[p('pct-100','Pacote com 100',100,'pct')]),
  product('guardanapo','Guardanapo','Embalagens','un','scroll','amber',[p('pct-personalizado','Pacote — informar quantidade',1,'pct')]),
  product('ketchup-sache','Ketchup sachê','Molhos','un','package-open','orange',[p('cx-156','Caixa com 156',156,'cx')]),
  product('maionese-sache','Maionese sachê','Molhos','un','package-open','orange',[p('cx-156','Caixa com 156',156,'cx')]),
  product('milho-verde','Milho-verde','Mercearia','kg','wheat','yellow',[p('lata-170g','Lata 170 g',0.17),p('lata-1-7kg','Lata 1,7 kg',1.7)]),
  product('batata-palha','Batata palha','Mercearia','kg','wheat','yellow',[p('pct-100g','Pacote 100 g',0.1,'pct'),p('pct-300g','Pacote 300 g',0.3,'pct'),p('pct-800g','Pacote 800 g',0.8,'pct'),p('pct-1kg','Pacote 1 kg',1,'pct')]),
  product('tomate','Tomate','Hortifrúti','kg','salad','emerald',[p('peso','Peso fracionado',1,'kg')]),
  product('alface','Alface','Hortifrúti','un','leafy-green','emerald',[p('un','Unidade',1)]),
  product('cebolinha','Cebolinha','Hortifrúti','un','sprout','emerald',[p('maco','Maço',1)]),
  product('oleo-soja-900ml','Óleo de soja 900 ml','Mercearia','l','bottle','yellow',[p('garrafa-900ml','Garrafa 900 ml',0.9)]),
  product('ovos-brancos','Ovos brancos','Mercearia','un','egg','yellow',[p('cartela-20','Cartela com 20',20,'pct'),p('cartela-30','Cartela com 30',30,'pct'),p('cx-360','Caixa com 360',360,'cx')]),
  product('sal-1kg','Sal','Temperos','kg','shaker','violet',[p('pct-1kg','Pacote 1 kg',1,'pct')]),
  product('acucar-1kg','Açúcar','Mercearia','kg','package','yellow',[p('pct-1kg','Pacote 1 kg',1,'pct')]),
  product('tempero-completo','Tempero completo','Temperos','kg','shaker','violet',[p('pote-300g','Pote 300 g',0.3),p('pct-1kg','Pacote 1 kg',1,'pct')]),
  product('coca-lata-310','Coca-Cola lata 310 ml','Bebidas','un','cup-soda','red',[p('un','Unidade',1)]),
  product('coca-zero-lata-310','Coca-Cola Zero lata 310 ml','Bebidas','un','cup-soda','zinc',[p('un','Unidade',1)]),
  product('fanta-1l','Fanta 1 L','Bebidas','un','bottle','orange',[p('un','Unidade',1),p('fardo-12','Fardo com 12',12,'fardo')]),
  product('coca-1l','Coca-Cola 1 L','Bebidas','un','bottle','red',[p('un','Unidade',1),p('fardo-12','Fardo com 12',12,'fardo')]),
  product('kuat-2l','Kuat 2 L','Bebidas','un','bottle','green',[p('un','Unidade',1),p('fardo-6','Fardo com 6',6,'fardo')]),
  product('coca-2l','Coca-Cola 2 L','Bebidas','un','bottle','red',[p('un','Unidade',1),p('fardo-6','Fardo com 6',6,'fardo')]),
  product('del-valle-uva-450','Del Valle Uva 450 ml','Bebidas','un','juice','violet',[p('un','Unidade',1),p('fardo-6','Fardo com 6',6,'fardo')]),
  product('del-valle-laranja-450','Del Valle Laranja 450 ml','Bebidas','un','juice','orange',[p('un','Unidade',1),p('fardo-6','Fardo com 6',6,'fardo')]),
  product('agua-sem-gas-500','Água mineral sem gás 500 ml','Bebidas','un','droplet','sky',[p('un','Unidade',1),p('fardo-12','Fardo com 12',12,'fardo')]),
  product('agua-com-gas-500','Água mineral com gás 500 ml','Bebidas','un','bubbles','sky',[p('un','Unidade',1),p('fardo-12','Fardo com 12',12,'fardo')]),
  product('detergente-500ml','Detergente 500 ml','Limpeza','l','sparkles','cyan',[p('un-500ml','Frasco 500 ml',0.5),p('fardo-6','Fardo com 6 frascos',3,'fardo')]),
  product('esponja','Esponja para louça','Limpeza','un','sparkles','cyan',[p('un','Unidade',1),p('pct-4','Pacote com 4',4,'pct')]),
  product('desinfetante','Desinfetante','Limpeza','l','spray-can','cyan',[p('un-1l','Frasco 1 L',1),p('galao-5l','Galão 5 L',5)]),
  product('agua-sanitaria','Água sanitária','Limpeza','l','spray-can','cyan',[p('un-1l','Frasco 1 L',1),p('galao-5l','Galão 5 L',5)]),
];

export const STOCK_CATALOG_VERSION = 'dfl-stock-v1-2026-09-09';

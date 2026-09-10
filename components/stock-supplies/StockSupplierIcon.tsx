// components/stock-supplies/StockSupplierIcon.tsx
'use client';
import { Beef,Flame,Leaf,Package,ShoppingCart,Store,Truck } from 'lucide-react';
import { STOCK_SUPPLIER_STYLE } from '@/lib/stock-suppliers';
import type { StockSupplier,StockSupplierType } from '@/types';

const icons={'shopping-cart':ShoppingCart,package:Package,beef:Beef,flame:Flame,leaf:Leaf,truck:Truck,store:Store};

export function StockSupplierIcon({supplier,fallbackType='outro'}:{supplier?:Pick<StockSupplier,'type'>;fallbackType?:StockSupplierType}){
 const style=STOCK_SUPPLIER_STYLE[supplier?.type||fallbackType];
 const Icon=icons[style.icon as keyof typeof icons]||Store;
 return <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${style.className}`}><Icon size={18}/></span>;
}

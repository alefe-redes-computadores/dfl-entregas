'use client';

import {
  useEffect, useRef, useState, useMemo } from 'react'; import { useRouter, useSearchParams } from 'next/navigation'; import {    ChevronLeft, Store, Smartphone, Banknote, QrCode,
  CreditCard, ChevronDown, AlertTriangle, Navigation, CheckCircle2, Link2,
  MessageCircle, Info, Sparkles, ClipboardPaste, Bike, ShoppingBag, Plus, Trash2, UsersRound, TicketPercent,
} from 'lucide-react';
import { toast } from 'sonner';
import { dateKey, routeDate, routeStartedAt } from '@/lib/operational-time';
import { useAppStore } from '@/store/useAppStore';
import { CustomerAutocomplete } from '@/components/deliveries/CustomerAutocomplete';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import { extractCoordinatesFromUrl, normalizeAddressText } from '@/lib/maps';
import { parseIfoodOrdersText } from '@/lib/ifood-order-parser';
import { assessIfoodParseQuality } from '@/lib/ifood-parser-quality';
import { loadInboxDay, markInboxDraft } from '@/lib/delivery-inbox';
import { geocodeAddress } from '@/lib/store-geocoding';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';
import { sameCustomerAddress } from '@/lib/customer-identity';
import {
  auditOperationalAddress,
  knownOperationalNeighborhoods,
} from '@/lib/address-quality';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Delivery, OrderOrigin, Customer, FulfillmentMode } from '@/types';

type ExtraIfoodOrderDraft = { id:string; orderId:string; ifoodId:string; confirmationCode:string; customerName:string; customerCharge:string; subsidy:string; paymentMethod:Delivery['payment_method']; isPaid:boolean; changeFor:string; };

export default function NovaEntregaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnDate = searchParams.get('date') || '';
  const sameStopDeliveryId = searchParams.get('sameStop') || '';
  const inboxDraftId = searchParams.get('inboxDraft') || '';
  const inboxDay = searchParams.get('inboxDay') || '';
  const requestedReturn = searchParams.get('returnTo') || '';
  const safeReturnTo = requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') ? requestedReturn : '';
  const todayDateKey = dateKey(new Date());
  const historicalContext = Boolean(returnDate && returnDate !== todayDateKey);
  const deliveriesReturn = historicalContext
    ? `/entregas?date=${encodeURIComponent(todayDateKey)}`
    : returnDate
      ? `/entregas?date=${encodeURIComponent(returnDate)}`
      : '/entregas';
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const addDelivery = useAppStore((state) => state.addDelivery);
  const addDeliveries = useAppStore((state) => state.addDeliveries);
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const deliveries = useAppStore((state) => state.deliveries);
  const findOrCreateCustomer = useAppStore((state) => state.findOrCreateCustomer);

  const openRoutes = useMemo(
    () =>
      routes.filter((route) => {
        if (route.status !== 'aberta') return false;
        const value = routeDate(route);
        return Boolean(value) && dateKey(value) === todayDateKey;
      }),
    [routes, todayDateKey],
  );

  const knownNeighborhoods = useMemo(
    () =>
      knownOperationalNeighborhoods(
        customers.flatMap((customer) => [
          customer.neighborhood,
          customer.address,
        ]),
      ),
    [customers],
  );

  const [magicText, setMagicText] = useState('');
  const [isParserOpen, setIsParserOpen] = useState(true);

  const [origin, setOrigin] = useState<OrderOrigin>('ifood');
    const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('delivery');
const [routeId, setRouteId] = useState('');
  const routeSelectionTouched = useRef(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [ifoodId, setIfoodId] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  const [streetAddress, setStreetAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');

  const [value, setValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [ifoodSubsidy, setIfoodSubsidy] = useState('');
  const [hasIfoodSubsidy, setHasIfoodSubsidy] = useState(false);
  const [extraIfoodOrders, setExtraIfoodOrders] = useState<ExtraIfoodOrderDraft[]>([]);
  const [multiOrderReviewOpen, setMultiOrderReviewOpen] = useState(false);
  const [fulfillmentOptionsOpen, setFulfillmentOptionsOpen] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const sameStopSeeded = useRef(false);
  const inboxSeeded = useRef(false);
  const sameStopSource = useMemo(
    () => deliveries.find((delivery) => delivery.id === sameStopDeliveryId),
    [deliveries, sameStopDeliveryId],
  );
  const customerIdentity = useMemo(() => {
    const normalizeIdentity = (value?: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
    const query = normalizeIdentity(customerName);
    if (!query) return null;
    const selected = customers.find((customer) => customer.id === selectedCustomerId);
    if (selected) return { kind: 'existing' as const, customer: selected, count: 1 };
    const matches = customers.filter((customer) => {
      const name = normalizeIdentity(customer.name);
      return name === query || (query.length >= 3 && (name.includes(query) || query.includes(name)));
    });
    if (matches.length === 1) return { kind: 'existing' as const, customer: matches[0], count: 1 };
    if (matches.length > 1) return { kind: 'multiple' as const, count: matches.length };
    return { kind: 'new' as const, count: 0 };
  }, [customerName, customers, selectedCustomerId]);

  useEffect(() => {
    if (!inboxDraftId || !inboxDay || inboxSeeded.current) return;

    const draft = loadInboxDay(inboxDay).drafts.find(
      (item) => item.id === inboxDraftId,
    );

    if (!draft) {
      toast.warning('Rascunho não encontrado na Caixa de Entrada.');
      return;
    }

    inboxSeeded.current = true;
    setMagicText(draft.rawText);
    setIsParserOpen(true);
    setOrigin(draft.source === 'ifood' ? 'ifood' : 'loja');

    toast.info('Rascunho carregado da Caixa de Entrada', {
      description:
        'Confira a leitura, escolha a rota e confirme o lançamento.',
    });
  }, [inboxDay, inboxDraftId]);

  useEffect(() => {
    if (!sameStopSource || sameStopSeeded.current) return;
    sameStopSeeded.current = true;
    setOrigin('ifood');
    setFulfillmentMode(sameStopSource.fulfillment_mode || 'delivery');
    setRouteId(sameStopSource.route_id || '');
    routeSelectionTouched.current = true;
    setStreetAddress(sameStopSource.address_string || '');
    setMapsLink(sameStopSource.maps_link || '');
    setCustomerName(sameStopSource.customer_name || '');
    setSelectedCustomerId(sameStopSource.customer_id || '');
    setPhone(formatPhoneInput(sameStopSource.phone || ''));
    setObservation(sameStopSource.observation || '');
    setIsParserOpen(false);
    toast.info('Nova entrega na mesma parada', {
      description: 'Endereço e rota foram reaproveitados. Preencha os dados deste pedido iFood.',
    });
  }, [sameStopSource]);

  useEffect(() => {
    if (fulfillmentMode !== 'delivery' || routeSelectionTouched.current) return;

    const currentStillEligible =
      routeId && openRoutes.some((route) => route.id === routeId);

    if (currentStillEligible) return;

    if (openRoutes.length === 1) {
      setRouteId(openRoutes[0].id);
      return;
    }

    /*
     * Contrato operacional real:
     * - aberta sem started_at/departure_time = Montando
     * - aberta com routeStartedAt()          = Na rua
     *
     * Só automatizamos quando existe uma única resposta inequívoca.
     */
    const assemblingRoutes = openRoutes.filter((route) => !routeStartedAt(route));

    if (assemblingRoutes.length === 1) {
      setRouteId(assemblingRoutes[0].id);
    }
  }, [fulfillmentMode, openRoutes, routeId]);

  const formatCurrencyInput = (inputValue: string) => {
    const onlyDigits = inputValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    const numberValue = parseInt(onlyDigits, 10) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPhoneInput = (val: string) => {
    const rawDigits = val.replace(/\D/g, '');
    const localDigits =
      rawDigits.startsWith('55') && (rawDigits.length === 12 || rawDigits.length === 13)
        ? rawDigits.slice(2)
        : rawDigits;
    const digits = localDigits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const normalizeMatchText = (value?: string | null) =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const resolveParsedRoute = (routeNumber: string, motoboyHint: string) => {
    const normalizedMotoboy = normalizeMatchText(motoboyHint);
    const hasRouteNumber = Boolean(routeNumber);
    const hasMotoboy = Boolean(normalizedMotoboy);

    if (!hasRouteNumber && !hasMotoboy) {
      return { routeId: '', candidates: [] as typeof openRoutes };
    }

    const candidates = openRoutes.filter((route) => {
      const routeName = normalizeMatchText(route.name);
      const motoboyName = normalizeMatchText(route.motoboy_name);

      const numberMatches =
        !hasRouteNumber ||
        new RegExp(`(?:^|\\s)${routeNumber}(?:\\s|$)`).test(routeName);

      const motoboyMatches =
        !hasMotoboy ||
        motoboyName === normalizedMotoboy ||
        motoboyName.includes(normalizedMotoboy) ||
        normalizedMotoboy.includes(motoboyName);

      return numberMatches && motoboyMatches;
    });

    return {
      routeId: candidates.length === 1 ? candidates[0].id : '',
      candidates,
    };
  };

  const handleExecuteMagicParse = async () => {
    if (!magicText.trim()) { toast.error('Cole o texto do pedido antes de processar.'); return; }
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    const parsedOrders=parseIfoodOrdersText(magicText,{
      knownNeighborhoods,
      knownCustomerNames:customers.map(customer=>customer.name),
    }); const parsed=parsedOrders[0]; const identified:string[]=[];
    if(parsed.orderId){setOrderId(parsed.orderId);identified.push(`Nº #${parsed.orderId}`)}
    if(parsed.ifoodId){setIfoodId(parsed.ifoodId);identified.push(`ID ${parsed.ifoodId}`)}
    if(parsed.confirmationCode){setConfirmationCode(parsed.confirmationCode);identified.push(`Cód. ${parsed.confirmationCode}`)}
    if(parsed.customerName){
      setCustomerName(parsed.customerName);
      const normalizedParsedName=parsed.customerName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
      const matchedCustomers=customers.filter(customer=>customer.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim()===normalizedParsedName);
      const matchedCustomer=matchedCustomers.length===1?matchedCustomers[0]:undefined;
      setSelectedCustomerId(matchedCustomer?.id||'');
      if(matchedCustomer){
        if(!parsed.phone&&matchedCustomer.phone)setPhone(formatPhoneInput(matchedCustomer.phone));
        if(!parsed.mapsLink&&matchedCustomer.maps_link)setMapsLink(matchedCustomer.maps_link);
        if(!parsed.address&&matchedCustomer.address)setStreetAddress(matchedCustomer.address);
        identified.push('Cliente vinculado');
      }else{
        identified.push('Cliente');
      }
    }
    if(parsed.phone){setPhone(formatPhoneInput(parsed.phone));identified.push('Zap')}
    if(parsed.address){setStreetAddress(parsed.address);identified.push('Endereço')}
    if(parsed.mapsLink){setMapsLink(parsed.mapsLink);identified.push('Link Maps')}
    if(parsed.paymentMethod){setPaymentMethod(parsed.paymentMethod);setIsPaid(parsed.isPaid);if(parsed.paymentMethod!=='dinheiro'||parsed.isPaid)setChangeFor('');identified.push(parsed.isPaid?'Pago no app':'Pagamento')}
    const charge=parsed.customerCharge||parsed.value;
    if(charge){setValue(formatCurrencyInput(charge.replace(/\D/g,'')));identified.push(`Cobrança R$ ${charge}`)}
    if(parsed.subsidy){setHasIfoodSubsidy(true);setIfoodSubsidy(formatCurrencyInput(parsed.subsidy.replace(/\D/g,'')));identified.push(`Cupom R$ ${parsed.subsidy}`)}else{setHasIfoodSubsidy(false);setIfoodSubsidy('')}
    if(parsed.changeFor){setChangeFor(formatCurrencyInput(parsed.changeFor.replace(/\D/g,'')));identified.push(`Troco p/ ${parsed.changeFor}`)}
    if(parsed.drinks.length){setDrinks(parsed.drinks.join(', '));identified.push('Bebidas')}
    if(parsed.observations.length){setObservation(current=>{const incoming=parsed.observations.join(' - ');return current&&!current.includes(incoming)?`${current} - ${incoming}`:current||incoming});identified.push('Obs')}
    const routeResolution=resolveParsedRoute(parsed.routeNumber,parsed.motoboyHint);if(routeResolution.routeId&&!routeSelectionTouched.current){setRouteId(routeResolution.routeId);identified.push(`Rota ${routeResolution.candidates[0].name}`)}
    if(parsedOrders.length>1){setExtraIfoodOrders(parsedOrders.slice(1).map((item,index)=>({id:`extra-${Date.now()}-${index}-${Math.random().toString(36).slice(2,6)}`,orderId:item.orderId,ifoodId:item.ifoodId,confirmationCode:item.confirmationCode||parsed.confirmationCode,customerName:item.customerName||parsed.customerName,customerCharge:item.customerCharge||item.value||charge,subsidy:item.subsidy,paymentMethod:item.paymentMethod||'dinheiro',isPaid:item.isPaid,changeFor:item.changeFor?formatCurrencyInput(item.changeFor.replace(/\D/g,'')):''})));setMultiOrderReviewOpen(true);identified.push(`${parsedOrders.length} pedidos no mesmo destino`)}else setExtraIfoodOrders([]);
    if(!identified.length){toast.error('Nenhum dado reconhecido no texto.');return}
    if(Capacitor.isNativePlatform())await Haptics.impact({style:ImpactStyle.Heavy});
    const parseQuality=assessIfoodParseQuality(parsedOrders);
    const qualitySummary=parseQuality.review>0
      ? `${parseQuality.complete} prontos · ${parseQuality.review} para revisar`
      : `${parseQuality.complete} ${parseQuality.complete===1?'pedido reconhecido':'pedidos reconhecidos'} · tudo certo`;

    if(parseQuality.review>0){
      toast.warning('Importação concluída com revisão necessária.',{
        description:qualitySummary,
        duration:6000
      });
    }else{
      toast.success(parsedOrders.length>1?'Pedidos reconhecidos.':'Pedido reconhecido.',{
        description:qualitySummary,
        duration:4500
      });
    }
    setMagicText('');setIsParserOpen(false);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMagicText(text);
        toast.info('Texto colado. Revise e toque em "Ler pedido e preencher campos".');
      }
    } catch {
      toast.error('Cole o texto manualmente na caixa.');
    }
  };

  const addressAudit = useMemo(() => {
    const coords = extractCoordinatesFromUrl(mapsLink);
    if (coords || (mapsLink && mapsLink.includes('http'))) {
      return {
        status: 'precise' as const,
        title: 'Link do Maps vinculado',
        desc: 'A entrega possui uma referência direta do Google Maps.'
      };
    }
    const liveAddressQuality = auditOperationalAddress(
      streetAddress,
      { knownNeighborhoods },
    );
    const hasNumber = !liveAddressQuality.issues.includes('missing-house-number');
    if (streetAddress.trim().length > 3 && hasNumber && !liveAddressQuality.needsReview) {
      return {
        status: 'good' as const,
        title: 'Rua e número informados',
        desc: 'Confira o bairro ou vincule um link do Maps quando houver dúvida.'
      };
    }
    if (streetAddress.trim().length > 0 && !hasNumber) {
      return {
        status: 'warning' as const,
        title: 'Atenção: Sem Número!',
        desc: 'Cole o link do Maps para evitar erros de rota.'
      };
    }
    return null;
  }, [streetAddress, mapsLink, knownNeighborhoods]);

  const handleCustomerSelect = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    if (c.address) setStreetAddress(c.address);
    if (c.phone) setPhone(formatPhoneInput(c.phone));
    if (c.observation) setObservation(c.observation);
    if (c.maps_link) setMapsLink(c.maps_link);
    if (c.last_confirmation_code && !confirmationCode) setConfirmationCode(c.last_confirmation_code);
    toast.success('Cliente carregado.');
  };

  const parseMoney = (input:string) => { const parsed=Number(input.replace(/\./g,'').replace(',','.')); return Number.isFinite(parsed)?parsed:0; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!value||(fulfillmentMode==='delivery'&&(!routeId||!streetAddress))){toast.error(fulfillmentMode==='delivery'?'Preencha os campos obrigatórios (Rota, Valor e Rua)':'Informe o valor do pedido');return}
    if(fulfillmentMode==='delivery'&&!openRoutes.some(route=>route.id===routeId)){toast.error('Selecione uma rota aberta da operação de hoje.');return}
    const drafts=origin==='ifood'?[{id:'primary',orderId,ifoodId,confirmationCode,customerName,customerCharge:value,subsidy:hasIfoodSubsidy?ifoodSubsidy:'',paymentMethod,isPaid,changeFor},...extraIfoodOrders]:[];
    if(origin==='ifood'){
      const invalid=drafts.find(d=>!d.orderId.trim()||(d.ifoodId&&d.ifoodId.replace(/\D/g,'').length!==8)||(d.confirmationCode&&d.confirmationCode.replace(/\D/g,'').length!==4));
      if(invalid){toast.error('Revise os identificadores iFood.',{description:'Cada pedido precisa de número; ID deve ter 8 dígitos e código deve ter 4 quando informados.'});return}
    }
    setIsSaving(true);
    try{
      const normalizedAddress=fulfillmentMode==='delivery'?canonicalizeOperationalAddress(streetAddress):{address:'',neighborhood:undefined,phone:undefined,observations:[] as string[]};
      const cleanStreet=fulfillmentMode==='delivery'?normalizedAddress.address:'';
      const addressQuality=fulfillmentMode==='delivery'
        ? auditOperationalAddress(streetAddress,{
            fallbackNeighborhood: normalizedAddress.neighborhood,
            knownNeighborhoods,
          })
        : null;
      const rawPhone=phone.replace(/\D/g,'')||normalizedAddress.phone||'';
      const cleanObservation=Array.from(new Set([observation.trim(),...normalizedAddress.observations].filter(Boolean))).join(' - ');

      if(addressQuality?.needsReview){
        toast.warning(addressQuality.label||'Confira o endereço',{
          description:`${addressQuality.description||'Revise os dados antes da saída.'} O pedido será salvo e ficará sinalizado no card.`,
          duration:5200,
        });
      }
      let resolvedMapsLink=mapsLink.trim();
      if(fulfillmentMode==='delivery'&&cleanStreet&&!resolvedMapsLink){try{const point=await geocodeAddress(cleanStreet);if(point)resolvedMapsLink=`https://www.google.com/maps?q=${point.lat},${point.lng}`}catch(error){console.warn('Não foi possível resolver coordenadas automaticamente:',error)}}
      const now=new Date().toISOString();
      const sameAddressSource = fulfillmentMode === 'delivery'
        ? deliveries.find((candidate) =>
            candidate.route_id === routeId &&
            candidate.id !== sameStopSource?.id &&
            !candidate.operational_dismissed_at &&
            sameCustomerAddress(candidate.address_string, cleanStreet),
          )
        : undefined;
      const stopSource = sameStopSource || sameAddressSource;
      const shouldGroupStop = Boolean(stopSource || (origin === 'ifood' && drafts.length > 1));
      const stopGroupId = stopSource?.stop_group_id ||
        (shouldGroupStop
          ? `stop-${stopSource?.id || Date.now()}-${stopSource ? 'linked' : Math.random().toString(36).slice(2, 7)}`
          : undefined);

      if (stopSource && !stopSource.stop_group_id && stopGroupId) {
        await updateDelivery(stopSource.id, { stop_group_id: stopGroupId });
      }

      if(origin==='ifood'){
        const deliveriesToCreate:Delivery[]=[];
        for(let index=0;index<drafts.length;index+=1){const draft=drafts[index];const draftName=draft.customerName.trim()||customerName.trim();const charge=Math.max(0,parseMoney(draft.customerCharge||'0'));const subsidy=Math.max(0,parseMoney(draft.subsidy||''));let customerId='';if(draftName){customerId=await findOrCreateCustomer(draftName,{address:fulfillmentMode==='delivery'?cleanStreet:undefined,phone:index===0?(rawPhone||undefined):undefined,mapsLink:fulfillmentMode==='delivery'?resolvedMapsLink:undefined,confirmationCode:draft.confirmationCode||undefined,observation:cleanObservation||undefined,origin,preferredCustomerId:index===0?(selectedCustomerId||undefined):undefined})}
          deliveriesToCreate.push({id:index===0?Date.now().toString():`${Date.now()}-${index}-${Math.random().toString(36).slice(2,6)}`,route_id:fulfillmentMode==='delivery'?routeId:'',fulfillment_mode:fulfillmentMode,stop_group_id:stopGroupId,origin,order_id:draft.orderId||undefined,ifood_id:draft.ifoodId||undefined,confirmation_code:draft.confirmationCode||undefined,customer_id:customerId,customer_name:draftName||undefined,value:charge+subsidy,customer_charge:charge,ifood_subsidy:subsidy>0?subsidy:undefined,is_paid:draft.isPaid,is_urgent:isUrgent,payment_method:draft.paymentMethod,change_for:draft.paymentMethod==='dinheiro'&&!draft.isPaid&&draft.changeFor?parseMoney(draft.changeFor):undefined,address_string:fulfillmentMode==='delivery'?cleanStreet:'',maps_link:fulfillmentMode==='delivery'?resolvedMapsLink:'',phone:index===0?(rawPhone||undefined):undefined,notify_whatsapp:index===0?notifyWhatsapp:false,observation:cleanObservation||undefined,drinks:index===0?drinks:'',createdAt:now,created_at:now,updated_at:now});
        }
        await addDeliveries(deliveriesToCreate);toast.success(drafts.length>1?`${drafts.length} pedidos cadastrados na mesma parada.`:'Entrega cadastrada com sucesso!');
      }else{
        let customerId='';if(customerName.trim())customerId=await findOrCreateCustomer(customerName,{address:fulfillmentMode==='delivery'?cleanStreet:undefined,phone:rawPhone||undefined,mapsLink:fulfillmentMode==='delivery'?resolvedMapsLink:undefined,observation:cleanObservation||undefined,origin,preferredCustomerId:selectedCustomerId||undefined});
        const cleanValue=parseMoney(value);await addDelivery({id:Date.now().toString(),route_id:fulfillmentMode==='delivery'?routeId:'',fulfillment_mode:fulfillmentMode,stop_group_id:stopGroupId,origin,customer_id:customerId,customer_name:customerName.trim()||undefined,value:cleanValue,customer_charge:cleanValue,is_paid:isPaid,is_urgent:isUrgent,payment_method:paymentMethod,change_for:changeFor?parseMoney(changeFor):undefined,address_string:fulfillmentMode==='delivery'?cleanStreet:'',maps_link:fulfillmentMode==='delivery'?resolvedMapsLink:'',phone:rawPhone||undefined,notify_whatsapp:notifyWhatsapp,observation:cleanObservation||undefined,drinks,createdAt:now,created_at:now,updated_at:now});toast.success(stopGroupId?'Entrega adicionada à parada existente.':'Entrega cadastrada com sucesso!');
      }
      if (inboxDraftId && inboxDay) {
        markInboxDraft(inboxDay, inboxDraftId, 'launched');
      }
      router.replace(safeReturnTo||deliveriesReturn);
    }catch(error){console.error('Erro ao cadastrar entrega:',error);toast.error('Não foi possível cadastrar a entrega.',{description:'Confira os dados e sua conexão e tente novamente.'})}finally{setIsSaving(false)}
  };

  return (
    <div className="relative flex flex-col gap-5 pb-28 animate-in fade-in duration-300">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace(safeReturnTo || deliveriesReturn)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          aria-label="Voltar aos pedidos"
        >
          <ChevronLeft size={21} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">
            Novo pedido
          </p>
          <h1 className="font-heading text-xl font-black text-zinc-50">
            Cadastrar pedido
          </h1>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            Origem, destino e dados da entrega
          </p>
        </div>
      </header>

      {historicalContext && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.07] px-4 py-3">
          <p className="text-xs font-black text-amber-300">Criação na operação de hoje</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
            Você veio de uma data histórica. Este novo pedido será registrado hoje e,
            ao salvar, a lista será aberta na data de hoje.
          </p>
        </div>
      )}


      {/* MODALIDADE OPERACIONAL — compacta */}
      <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">01 · Modalidade</p><p className="mt-1 text-sm font-black text-zinc-200">{fulfillmentMode==='delivery'?'Entrega':fulfillmentMode==='pickup'?'Retirada na loja':'Balcão / presencial'}</p></div>
          <button type="button" onClick={()=>setFulfillmentOptionsOpen(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-[11px] font-black text-zinc-400">Alterar <ChevronDown size={14} className={fulfillmentOptionsOpen?'rotate-180':''}/></button>
        </div>
        {fulfillmentOptionsOpen&&(<div className="mt-3 grid grid-cols-3 gap-2">{([['delivery','Entrega',Bike],['pickup','Retirada',ShoppingBag],['counter','Balcão',Store]] as const).map(([mode,label,Icon])=><button key={mode} type="button" onClick={()=>{setFulfillmentMode(mode);setFulfillmentOptionsOpen(false);setIsRouteDropdownOpen(false)}} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-[10px] font-black ${fulfillmentMode===mode?'border-amber-500/45 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-950/30 text-zinc-500'}`}><Icon size={16}/>{label}</button>)}</div>)}
      </section>

      {/* SELETOR DE ORIGEM (iFood vs Loja Própria) */}
      <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/40 p-3"><div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">02 · Origem</p><p className="mt-1 text-sm font-black text-zinc-200">De onde veio o pedido?</p></div><div className="flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-1">
        <button
          type="button"
          onClick={() => setOrigin('ifood')}
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'ifood' ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Smartphone size={18} /> iFood
        </button>
        <button
          type="button"
          onClick={() => {
            setOrigin('loja');
            setOrderId('');
            setIfoodId('');
            setConfirmationCode('');
            setMagicText('');
          }}
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${origin === 'loja' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Store size={18} /> Loja Própria
        </button>
      </div></section>

      {/* CAIXA DE TEXTO DO PARSER (APENAS QUANDO FOR IFOOD) */}
      {origin === 'ifood' && !isParserOpen && (
        <button
          type="button"
          onClick={() => setIsParserOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 text-xs font-bold text-red-400 active:scale-[0.98]"
        >
          <Sparkles size={15} /> Colar outro pedido do iFood
        </button>
      )}

      {origin === 'ifood' && isParserOpen && (
        <div className="flex flex-col gap-3 rounded-[26px] border border-red-500/20 bg-gradient-to-b from-red-500/10 to-zinc-900/40 p-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" /> Leitor inteligente do iFood
            </span>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 bg-zinc-800/90 hover:bg-zinc-700 px-3 py-1 rounded-full active:scale-95 transition-all shadow-sm"
            >
              <ClipboardPaste size={12} className="text-red-400" /> Colar do Celular
            </button>
          </div>

          <textarea
            rows={3}
            placeholder="Cole aqui o texto do iFood..."
            value={magicText}
            onChange={(e) => setMagicText(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/50 outline-none resize-none font-mono"
          />

          <button
            type="button"
            onClick={handleExecuteMagicParse}
            className="h-11 w-full rounded-xl bg-red-500 hover:bg-red-400 font-bold text-white text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-red-500/20"
          >
            <Sparkles size={15} /> Ler pedido e preencher campos
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {fulfillmentMode === 'delivery' && (
          <>
            {openRoutes.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/rotas/nova?date=${encodeURIComponent(
                      historicalContext ? todayDateKey : returnDate || todayDateKey,
                    )}`,
                  )
                }
                className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left"
              >
                <p className="text-sm font-black text-amber-400">Nenhuma rota aberta</p>
                <p className="mt-1 text-xs text-zinc-400">Crie uma rota para registrar uma entrega.</p>
              </button>
            )}
        {/* ROTA */}
        <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-500">03 · Logística</p>
            <p className="mt-1 text-sm font-black text-zinc-200">Rota responsável</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Somente rotas abertas da operação de hoje aparecem aqui.
            </p>
          </div>
        <div className="relative flex flex-col gap-2">
          <label className="text-xs font-bold text-zinc-500">Selecionar rota</label>
          <button
            type="button"
            onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
            className={`flex h-14 w-full items-center justify-between rounded-2xl border bg-zinc-900/50 px-4 text-left transition-colors ${isRouteDropdownOpen ? 'border-emerald-500' : 'border-zinc-800'}`}
          >
            <span className={routeId ? 'text-zinc-100' : 'text-zinc-500'}>
              {routeId ? (
                <span className="font-semibold">
                  {openRoutes.find(r => r.id === routeId)?.name} <span className="text-zinc-400 font-normal">({openRoutes.find(r => r.id === routeId)?.motoboy_name})</span>
                </span>
              ) : 'Selecione a rota...'}
            </span>
            <ChevronDown size={20} className={`text-zinc-500 transition-transform ${isRouteDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isRouteDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setIsRouteDropdownOpen(false)} />}

          {isRouteDropdownOpen && (
            <div className="absolute top-[84px] z-30 flex max-h-56 w-full flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              {openRoutes.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { routeSelectionTouched.current = true; setRouteId(r.id); setIsRouteDropdownOpen(false); }}
                  className="flex items-center justify-between px-4 py-4 text-left text-sm active:bg-zinc-800 border-b border-zinc-800/50 last:border-0"
                >
                  <span className={`font-semibold ${routeId === r.id ? 'text-emerald-500' : 'text-zinc-200'}`}>
                    {r.name} <span className={routeId === r.id ? 'text-emerald-500/70' : 'text-zinc-500 font-normal'}>({r.motoboy_name})</span>
                  </span>
                  {routeId === r.id ? (
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  ) : (
                    <div className="h-2 w-2 rounded-full border border-zinc-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        </section>

          </>
        )}
        {/* IDENTIFICADORES DO IFOOD */}
        {origin === 'ifood' && (
          <section className="rounded-[24px] border border-red-500/15 bg-red-500/[.035] p-4 animate-in fade-in"><div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">04 · Identificadores iFood</p><p className="mt-1 text-[11px] text-zinc-600">Número do pedido, ID e código de confirmação.</p></div><div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-emerald-400">Nº Pedido*</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 5463"
                maxLength={5}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="h-12 rounded-xl border-2 border-emerald-500/50 bg-zinc-900/80 px-3 text-base font-bold text-zinc-50 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 relative">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold text-zinc-400">ID Pedido</label>
                <button type="button" onClick={() => toast.info('ID do Pedido: 8 dígitos do iFood')} className="text-zinc-500 hover:text-sky-400"><Info size={12} /></button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 60873228"
                maxLength={8}
                value={ifoodId}
                onChange={(e) => setIfoodId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className={`h-12 rounded-xl border bg-zinc-900/50 px-3 text-sm text-zinc-100 focus:outline-none ${ifoodId.length > 0 && ifoodId.length < 8 ? 'border-amber-500' : 'border-zinc-800 focus:border-emerald-500'}`}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5 relative">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold text-zinc-400">Código de confirmação</label>
                <button type="button" onClick={() => toast.info('Código: 4 dígitos informados pelo cliente')} className="text-zinc-500 hover:text-sky-400"><Info size={12} /></button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 1234"
                maxLength={4}
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={`h-12 rounded-xl border bg-zinc-900/50 px-3 text-sm text-zinc-100 font-mono font-bold tracking-widest focus:outline-none ${confirmationCode.length > 0 && confirmationCode.length < 4 ? 'border-amber-500' : 'border-zinc-800 focus:border-emerald-500'}`}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div><p className="text-[11px] font-black text-zinc-200">Mais pedidos neste endereço?</p><p className="mt-0.5 text-[10px] text-zinc-600">Uma parada física; clientes, IDs e códigos ficam separados.</p></div>
            <button type="button" onClick={()=>{setExtraIfoodOrders(current=>[...current,{id:`manual-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,orderId:'',ifoodId:'',confirmationCode,customerName,customerCharge:value,subsidy:hasIfoodSubsidy?ifoodSubsidy:'',paymentMethod,isPaid,changeFor}]);setMultiOrderReviewOpen(true)}} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-black text-red-400"><Plus size={13}/>Adicionar</button>
          </div>
          {extraIfoodOrders.length>0&&(<button type="button" onClick={()=>setMultiOrderReviewOpen(true)} className="mt-2 flex h-11 w-full items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/[.06] px-3"><span className="flex items-center gap-2 text-[11px] font-black text-violet-300"><UsersRound size={14}/>{extraIfoodOrders.length+1} pedidos na mesma parada</span><span className="text-[10px] font-bold text-zinc-500">Revisar</span></button>)}
          </section>
        )}

        {/* CLIENTE E WHATSAPP */}
        <section className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">05 · Cliente</p><p className="mt-1 text-sm font-black text-zinc-200">Contato e identificação</p></div>
          <CustomerAutocomplete
            value={customerName}
            onChange={(nextName) => {
              setCustomerName(nextName);
              setSelectedCustomerId('');
            }}
            onSelect={handleCustomerSelect}
            customers={customers}
          />
          {customerIdentity && (
            <div className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${customerIdentity.kind === 'existing' ? 'border-emerald-500/25 bg-emerald-500/[.07] text-emerald-300' : customerIdentity.kind === 'multiple' ? 'border-amber-500/25 bg-amber-500/[.07] text-amber-300' : 'border-violet-500/25 bg-violet-500/[.07] text-violet-300'}`}>
              {customerIdentity.kind === 'existing'
                ? `Cliente encontrado: ${customerIdentity.customer?.name}. O cadastro existente será reutilizado sem duplicação.`
                : customerIdentity.kind === 'multiple'
                  ? `${customerIdentity.count} clientes parecidos encontrados. Escolha um na lista para evitar duplicação.`
                  : 'Cliente novo: será cadastrado com os dados deste pedido.'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                inputMode="tel"
                placeholder="WhatsApp: (34) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setNotifyWhatsapp(!notifyWhatsapp);
              }}
              className={`flex items-center gap-1.5 h-12 px-4 rounded-xl border text-xs font-bold transition-all active:scale-95 shrink-0 ${
                notifyWhatsapp
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              <MessageCircle size={15} /> Avisar no Zap
            </button>
          </div>
        </section>

        {fulfillmentMode === 'delivery' && (
          <>
        {/* ENDEREÇO E LINK MAPS */}
        <section className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">06 · Destino</p>
            <p className="mt-1 text-sm font-black text-zinc-200">Endereço da entrega</p>
          </div>
          <AddressAutocomplete
            value={streetAddress}
            onChange={setStreetAddress}
            onMapsLinkDetected={setMapsLink}
            placeholder="Ex: Rua Zeca Mota, 123 — Alvorada"
            label="Endereço da Entrega*"
            localityHint="Patos de Minas · MG"
          />

          {addressAudit && (
            <div className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
              addressAudit.status === 'precise'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : addressAudit.status === 'good'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <div className="mt-0.5 shrink-0">
                {addressAudit.status === 'precise' ? (
                  <Navigation size={16} className="animate-pulse" />
                ) : addressAudit.status === 'good' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold">{addressAudit.title}</span>
                <span className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">{addressAudit.desc}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
              <Link2 size={13} className="text-sky-400" /> Link Manual / Coordenadas (Opcional)
            </label>
            <input
              type="text"
              placeholder="Cole o link do Maps ou coordenadas @lat,lng"
              value={mapsLink}
              onChange={(e) => setMapsLink(e.target.value)}
              className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </section>

          </>
        )}
        {/* FINANCEIRO E PRODUTOS */}
        <section className="flex flex-col gap-4 rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">07 · Financeiro</p>
            <p className="mt-1 text-sm font-black text-zinc-200">Valor, pagamento e observações</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300">{origin==='ifood'&&hasIfoodSubsidy?'Cliente paga (R$)*':'Valor (R$)*'}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
                className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Bebidas</label>
              <input
                type="text"
                placeholder="Ex: 1 Coca 2L"
                value={drinks}
                onChange={(e) => setDrinks(e.target.value)}
                className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {origin==='ifood'&&(<div className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-3"><button type="button" onClick={()=>{setHasIfoodSubsidy(v=>!v);if(hasIfoodSubsidy)setIfoodSubsidy('')}} className="flex w-full items-center justify-between gap-3 text-left"><span className="flex items-center gap-2"><TicketPercent size={15} className={hasIfoodSubsidy?'text-emerald-400':'text-zinc-600'}/><span><strong className="block text-[11px] text-zinc-300">Cupom / subsídio do iFood</strong><span className="text-[9px] text-zinc-600">O motoboy cobra somente o valor do cliente.</span></span></span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${hasIfoodSubsidy?'bg-emerald-500/10 text-emerald-400':'bg-zinc-800 text-zinc-500'}`}>{hasIfoodSubsidy?'Ativo':'Adicionar'}</span></button>{hasIfoodSubsidy&&(
            <div className="mt-3 grid grid-cols-2 items-stretch gap-2">
              <label className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/45 p-2.5">
                <span className="text-[9px] font-black uppercase tracking-wide text-zinc-500">
                  iFood cobre
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={ifoodSubsidy}
                  onChange={e=>setIfoodSubsidy(formatCurrencyInput(e.target.value))}
                  className="mt-1 h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/55 px-3 text-base font-black text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>

              <div className="flex min-w-0 flex-col justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[.055] p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wide text-emerald-500">
                  Total do pedido
                </p>
                <p className="mt-1 truncate text-base font-black text-zinc-100">
                  R$ {(parseMoney(value)+parseMoney(ifoodSubsidy)).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                </p>
                <p className="mt-0.5 truncate text-[8px] font-bold text-zinc-600">
                  Cliente {parseMoney(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </p>
              </div>
            </div>
          )}</div>)}

          <div className={`flex flex-col gap-2 transition-all duration-300 ${isPaid ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <label className="text-xs font-semibold text-zinc-400">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => { setPaymentMethod('dinheiro'); setIsPaid(false); }} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${paymentMethod === 'dinheiro' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <Banknote size={20} />
                <span className="text-xs font-bold">Dinheiro</span>
              </button>
              <button type="button" onClick={() => setPaymentMethod('pix')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${paymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <QrCode size={20} />
                <span className="text-xs font-bold">Pix</span>
              </button>
              <button type="button" onClick={() => { setPaymentMethod('cartao'); setIsPaid(false); }} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${(paymentMethod as string) === 'cartao' ? 'border-sky-500 bg-sky-500/10 text-sky-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <CreditCard size={20} />
                <span className="text-xs font-bold">Cartão</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'pix' && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-200">Pago antecipado?</span>
                <span className="text-[10px] text-zinc-500">Marque quando o Pix já foi recebido</span>
              </div>
              <button type="button" onClick={() => setIsPaid(!isPaid)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${isPaid ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isPaid ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {paymentMethod === 'dinheiro' && !isPaid && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Troco para (R$)</label>
              <input type="text" inputMode="numeric" placeholder="Ex: 50,00" value={changeFor} onChange={(e) => setChangeFor(formatCurrencyInput(e.target.value))} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400">Observação / Portão / Complemento</label>
            <input type="text" placeholder="Ex: Ap. 11B, Portão preto..." value={observation} onChange={(e) => setObservation(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-xl transition-all border ${isUrgent ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex flex-col">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isUrgent ? 'text-red-400' : 'text-zinc-300'}`}>
                <AlertTriangle size={15} className={isUrgent ? "text-red-500" : "text-zinc-500"} /> Entrega Urgente?
              </span>
              <span className="text-[10px] text-zinc-500">Prioridade na rota</span>
            </div>
            <button type="button" onClick={() => setIsUrgent(!isUrgent)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${isUrgent ? 'bg-red-500' : 'bg-zinc-700'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isUrgent ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>

        <button type="submit" disabled={isSaving} className="mt-2 h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-amber-500/20 transition-all">
          {isSaving ? 'Salvando...' : 'Salvar Entrega'}
        </button>
      </form>
      {multiOrderReviewOpen&&(<div className="fixed inset-0 z-[140] flex items-end bg-black/80 p-2 backdrop-blur-sm min-[380px]:p-3 sm:items-center sm:justify-center" onClick={()=>setMultiOrderReviewOpen(false)}><section className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-zinc-800 bg-zinc-950 p-4 min-[380px]:rounded-[28px] min-[380px]:p-5" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">Mesma parada</p><h2 className="mt-1 text-lg font-black text-zinc-100">Revisar pedidos importados</h2><p className="mt-1 text-[11px] text-zinc-500">Os pedidos compartilham esta parada. Confira os campos incompletos antes de salvar.</p></div><button type="button" onClick={()=>setMultiOrderReviewOpen(false)} className="h-9 shrink-0 rounded-xl border border-zinc-800 px-3 text-[10px] font-black text-zinc-400">Fechar</button></div><div className="mt-4 space-y-3">{extraIfoodOrders.map((draft,index)=><article key={draft.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase text-zinc-500">Pedido {index+2}</p><button type="button" onClick={()=>setExtraIfoodOrders(c=>c.filter(x=>x.id!==draft.id))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400"><Trash2 size={13}/></button></div><div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2"><input value={draft.customerName} onChange={e=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,customerName:e.target.value}:x))} placeholder="Cliente deste pedido" className="h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-xs text-zinc-100 min-[380px]:col-span-2"/><input value={draft.orderId} onChange={e=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,orderId:e.target.value.replace(/\D/g,'')}:x))} placeholder="Nº pedido" inputMode="numeric" className="h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-xs text-zinc-100"/><input value={draft.ifoodId} onChange={e=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,ifoodId:e.target.value.replace(/\D/g,'').slice(0,8)}:x))} placeholder="ID 8 dígitos" inputMode="numeric" className="h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-xs text-zinc-100"/><input value={draft.customerCharge} onChange={e=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,customerCharge:formatCurrencyInput(e.target.value)}:x))} placeholder="Cliente paga" inputMode="numeric" className="h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-xs text-zinc-100"/><input value={draft.subsidy} onChange={e=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,subsidy:formatCurrencyInput(e.target.value)}:x))} placeholder="Cupom / subsídio" inputMode="numeric" className="h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-xs text-zinc-100 min-[380px]:col-span-2"/>
<div className="grid grid-cols-3 gap-2 min-[380px]:col-span-2">{(['dinheiro','pix','cartao'] as const).map(method=><button key={method} type="button" onClick={()=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,paymentMethod:method,isPaid:method==='pix'?x.isPaid:false,changeFor:method==='dinheiro'?x.changeFor:''}:x))} className={`h-9 rounded-lg border text-[9px] font-black uppercase ${draft.paymentMethod===method?'border-violet-500/40 bg-violet-500/10 text-violet-300':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{method==='cartao'?'Cartão':method}</button>)}</div>
{draft.paymentMethod==='pix'&&<button type="button" onClick={()=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,isPaid:!x.isPaid}:x))} className={`h-10 rounded-xl border text-[10px] font-black min-[380px]:col-span-2 ${draft.isPaid?'border-emerald-500/30 bg-emerald-500/10 text-emerald-400':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{draft.isPaid?'Pago no app ✓':'Pix ainda pendente'}</button>}
{draft.paymentMethod==='dinheiro'&&!draft.isPaid&&<input value={draft.changeFor} onChange={e=>setExtraIfoodOrders(c=>c.map(x=>x.id===draft.id?{...x,changeFor:formatCurrencyInput(e.target.value)}:x))} placeholder="Troco para quanto?" inputMode="numeric" className="h-11 rounded-xl border border-amber-500/20 bg-amber-500/[.04] px-3 text-xs text-amber-200 min-[380px]:col-span-2"/>}</div></article>)}</div><button type="button" onClick={()=>setExtraIfoodOrders(c=>[...c,{id:`manual-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,orderId:'',ifoodId:'',confirmationCode,customerName,customerCharge:value,subsidy:hasIfoodSubsidy?ifoodSubsidy:'',paymentMethod,isPaid,changeFor}])} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-500/30 bg-violet-500/[.05] text-[11px] font-black text-violet-300"><Plus size={14}/>Outro pedido neste endereço</button></section></div>)}
    </div>
  );
}

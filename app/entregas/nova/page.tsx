'use client';
import { readActiveOperationalRouteId, rememberActiveOperationalRouteId } from '@/lib/route-ui-storage';
import { formatBrazilPhone, normalizeBrazilPhone } from '@/lib/phone';

import {
  useEffect, useRef, useState, useMemo, useDeferredValue } from 'react'; import { useRouter, useSearchParams } from 'next/navigation'; import {    ChevronLeft, Store, Smartphone, Banknote, QrCode,
  CreditCard, ChevronDown, AlertTriangle, Navigation, CheckCircle2, Link2,
  MessageCircle, Info, Sparkles, ClipboardPaste, Bike, ShoppingBag, Plus, Trash2, UsersRound, TicketPercent,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { dateKey, routeDate, routeStartedAt } from '@/lib/operational-time';
import { paymentStateForInput } from '@/lib/delivery-finance';
import { firstMultiOrderIssue } from '@/lib/operation/multiOrderDraft';
import { useAppStore } from '@/store/useAppStore';
import { CustomerAutocomplete } from '@/components/deliveries/CustomerAutocomplete';
import { CustomerDestinationSheet } from '@/components/customers/CustomerDestinationSheet';
import { customerPhones, customerAddresses } from '@/lib/customer-contact-book';
import type { CustomerPhone, CustomerAddress } from '@/types';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import { LocationEvidencePreview } from '@/components/deliveries/LocationEvidencePreview';
import { extractCoordinatesFromUrl, normalizeAddressText } from '@/lib/maps';
import { parseIfoodOrdersText } from '@/lib/ifood-order-parser';
import { normalizeFood99Order } from '@/lib/food99-order';
import { assessIfoodParseQuality, buildIfoodParseGuide, buildIfoodRecognitionSummary } from '@/lib/ifood-parser-quality';
import { loadInboxDay, markInboxDraft } from '@/lib/delivery-inbox';
import { geocodeAddress } from '@/lib/store-geocoding';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';
import { customerIdentityEvidence, sameCustomerAddress } from '@/lib/customer-identity';
import {
  auditOperationalAddress,
  knownOperationalNeighborhoods,
} from '@/lib/address-quality';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Delivery, OrderOrigin, Customer, FulfillmentMode } from '@/types';
import { hasOwnerIdentity, ownerContextFlags, type OwnerOrderContext } from '@/lib/owner-order-context';

type ExtraIfoodOrderDraft = { id:string; orderId:string; ifoodId:string; confirmationCode:string; customerName:string; customerCharge:string; subsidy:string; paymentMethod:Delivery['payment_method']; isPaid:boolean; changeFor:string; address:string; phone:string; mapsLink:string; drinks:string; observation:string; notifyWhatsapp:boolean; };

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
  const isSyncing = useAppStore((state) => state.isSyncing);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const marketplaceModes = useAppStore((state) => state.storeSettings.marketplaceDeliveryModes);
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

  const [origin, setOrigin] = useState<OrderOrigin>('ifood');
  const isFood99 = origin === 'food99';
  const [magicText, setMagicText] = useState('');
  const deferredMagicText = useDeferredValue(magicText);
  const [isParserOpen, setIsParserOpen] = useState(true);  const inboxParsedRef = useRef<ReturnType<typeof parseIfoodOrdersText>[number] | null>(null);
  const liveParsedOrders = useMemo(() => {
    if (deferredMagicText.trim().length < 2) return [];
    const base = parseIfoodOrdersText(deferredMagicText, {
      knownNeighborhoods,
      knownCustomerNames: customers.map((customer) => customer.name),
    });
    return isFood99 ? base.map(item => normalizeFood99Order(deferredMagicText, item)) : base;
  }, [customers, knownNeighborhoods, deferredMagicText, isFood99]);
  const liveParseQuality = useMemo(
    () => assessIfoodParseQuality(liveParsedOrders),
    [liveParsedOrders],
  );
  const parserUpdating = magicText !== deferredMagicText;
  const liveGuide = useMemo(() => buildIfoodParseGuide(deferredMagicText, liveParsedOrders[0]), [deferredMagicText, liveParsedOrders]);
  const parserGuideRef = useRef<HTMLDivElement | null>(null);
  const parserInputRef = useRef<HTMLTextAreaElement | null>(null);
  const liveRecognition = useMemo(() => buildIfoodRecognitionSummary(liveParsedOrders), [liveParsedOrders]);


    const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('delivery');
const [routeId, setRouteId] = useState('');
  const routeSelectionTouched = useRef(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [ifoodId, setIfoodId] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [pendingContactCustomer,setPendingContactCustomer]=useState<Customer|null>(null);
  const typedCustomerBeforeSelection = useRef('');
  const previousCustomerDraft = useRef<{name:string;phone:string;address:string;mapsLink:string;observation:string}|null>(null);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('');
  const [sameStopIdentityMode, setSameStopIdentityMode] = useState<'new' | 'same'>('new');
  const [phone, setPhone] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [excludeCustomerMetrics, setExcludeCustomerMetrics] = useState(false);
  const [ownerOrderContext, setOwnerOrderContext] = useState<OwnerOrderContext | ''>('');

  const [streetAddress, setStreetAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');

  const [value, setValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Delivery['payment_method']>('dinheiro');
  const [isPaid, setIsPaid] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [ifoodSubsidy, setIfoodSubsidy] = useState('');
  const [hasIfoodSubsidy, setHasIfoodSubsidy] = useState(false);
  const [fulfillmentOptionsOpen, setFulfillmentOptionsOpen] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [drinks, setDrinks] = useState('');
  const [observation, setObservation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [extraIfoodOrders, setExtraIfoodOrders] = useState<ExtraIfoodOrderDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState('primary');
  const activeExtra = origin === 'ifood' ? extraIfoodOrders.find((draft) => draft.id === activeDraftId) : undefined;
  const isMarketplace = origin === 'ifood' || origin === 'food99';
  const updateActiveExtra = (patch: Partial<ExtraIfoodOrderDraft>) =>
    setExtraIfoodOrders((current) => current.map((draft) => draft.id === activeDraftId ? {...draft, ...patch} : draft));
  const activeOrderId = activeExtra?.orderId ?? orderId;
  const activeIfoodId = activeExtra?.ifoodId ?? ifoodId;
  const activeConfirmationCode = activeExtra?.confirmationCode ?? confirmationCode;
  const activeCustomerName = activeExtra?.customerName ?? customerName;
  const activePhone = activeExtra?.phone ?? phone;
  const activeAddress = activeExtra?.address ?? streetAddress;
  const activeMapsLink = activeExtra?.mapsLink ?? mapsLink;
  const activeValue = activeExtra?.customerCharge ?? value;
  const activeSubsidy = activeExtra?.subsidy ?? ifoodSubsidy;
  const activeHasSubsidy = activeExtra ? Boolean(activeExtra.subsidy) : hasIfoodSubsidy;
  const activePaymentMethod = activeExtra?.paymentMethod ?? paymentMethod;
  const activeIsPaid = activeExtra?.isPaid ?? isPaid;
  const activeChangeFor = activeExtra?.changeFor ?? changeFor;
  const activeDrinks = activeExtra?.drinks ?? drinks;
  const activeObservation = activeExtra?.observation ?? observation;
  const activeNotifyWhatsapp = activeExtra?.notifyWhatsapp ?? notifyWhatsapp;
  const setActiveOrderId = (next: string) => activeExtra ? updateActiveExtra({orderId:next}) : setOrderId(next);
  const setActiveIfoodId = (next: string) => activeExtra ? updateActiveExtra({ifoodId:next}) : setIfoodId(next);
  const setActiveConfirmationCode = (next: string) => activeExtra ? updateActiveExtra({confirmationCode:next}) : setConfirmationCode(next);
  const setActiveCustomerName = (next: string) => activeExtra ? updateActiveExtra({customerName:next}) : setCustomerName(next);
  const setActivePhone = (next: string) => activeExtra ? updateActiveExtra({phone:next}) : setPhone(next);
  const setActiveAddress = (next: string) => activeExtra ? updateActiveExtra({address:next}) : setStreetAddress(next);
  const setActiveMapsLink = (next: string) => activeExtra ? updateActiveExtra({mapsLink:next}) : setMapsLink(next);
  const setActiveValue = (next: string) => activeExtra ? updateActiveExtra({customerCharge:next}) : setValue(next);
  const setActiveSubsidy = (next: string) => activeExtra ? updateActiveExtra({subsidy:next}) : setIfoodSubsidy(next);
  const setActivePaymentMethod = (next: Delivery['payment_method']) => activeExtra ? updateActiveExtra({paymentMethod:next}) : setPaymentMethod(next);
  const setActiveIsPaid = (next: boolean) => activeExtra ? updateActiveExtra({isPaid:next}) : setIsPaid(next);
  const setActiveChangeFor = (next: string) => activeExtra ? updateActiveExtra({changeFor:next}) : setChangeFor(next);
  const setActiveDrinks = (next: string) => activeExtra ? updateActiveExtra({drinks:next}) : setDrinks(next);
  const setActiveObservation = (next: string) => activeExtra ? updateActiveExtra({observation:next}) : setObservation(next);
  const setActiveNotifyWhatsapp = (next: boolean) => activeExtra ? updateActiveExtra({notifyWhatsapp:next}) : setNotifyWhatsapp(next);
  const ownerIdentityDetected = useMemo(() => hasOwnerIdentity({name: activeCustomerName, phone: activePhone}), [activeCustomerName, activePhone]);
  const ownerIdentityAmongDrafts = useMemo(() => ownerIdentityDetected || hasOwnerIdentity({name: customerName, phone}) || extraIfoodOrders.some((draft) => hasOwnerIdentity({name: draft.customerName, phone: draft.phone})), [ownerIdentityDetected, customerName, phone, extraIfoodOrders]);

  const sameStopSeeded = useRef(false);
  const inboxSeeded = useRef(false);
  const sameStopSource = useMemo(
    () => deliveries.find((delivery) => delivery.id === sameStopDeliveryId),
    [deliveries, sameStopDeliveryId],
  );
  const customerIdentity = useMemo(() => {
    const normalizeIdentity = (value?: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
    const query = normalizeIdentity(activeCustomerName);
    if (!query) return null;
    const identityDetails = { address: activeAddress || undefined, phone: activePhone || undefined };
    const reusable = customers.map((customer) => ({ customer, evidence: customerIdentityEvidence(customer, activeCustomerName, identityDetails) })).filter((item) => item.evidence.reusable).sort((a,b) => b.evidence.score - a.evidence.score);
    if (reusable.length === 1) return { kind: 'existing' as const, customer: reusable[0].customer, count: 1 };
    if (reusable.length > 1) return { kind: 'multiple' as const, count: reusable.length };
    const sameAddressCandidates = customers.filter((customer) => Boolean(activeAddress && customer.address && sameCustomerAddress(customer.address, activeAddress)));
    if (sameAddressCandidates.length) return { kind: 'same_address' as const, count: sameAddressCandidates.length };
    return { kind: 'new' as const, count: 0 };
  }, [activeCustomerName, customers, activePhone, selectedCustomerId, activeAddress]);

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
    // Caixa ja fez o parse; reler exige um segundo toque e pode alterar os dados.
    // O texto bruto continua no leitor recolhido para revisao opcional.
    setIsParserOpen(false);
    inboxParsedRef.current = null;
    const parsed = draft.parsed;
    const draftOrigin: OrderOrigin = draft.source === 'ifood' ? 'ifood' : draft.source === 'food99' ? 'food99' : 'loja';
    setOrigin(draftOrigin);
    setFulfillmentMode(draftOrigin === 'food99' ? (marketplaceModes?.food99 === 'dfl' ? 'delivery' : 'external_delivery')
      : draftOrigin === 'ifood' && marketplaceModes?.ifood === 'platform' ? 'external_delivery' : 'delivery');
    setOrderId(parsed.orderId || '');
    setIfoodId(draftOrigin === 'ifood' ? (parsed.ifoodId || '') : '');
    setConfirmationCode(draftOrigin === 'ifood' ? (parsed.confirmationCode || '') : '');
    setCustomerName(parsed.customerName || '');
    setSelectedCustomerId('');
    setPhone(formatPhoneInput(parsed.phone || ''));
    setStreetAddress(parsed.address || '');
    setMapsLink(parsed.mapsLink || '');
    const price = parsed.customerCharge || parsed.value || '';
    setValue(price ? formatCurrencyInput(price.replace(/\D/g, '')) : '');
    setHasIfoodSubsidy(Boolean(parsed.subsidy));
    setIfoodSubsidy(parsed.subsidy ? formatCurrencyInput(parsed.subsidy.replace(/\D/g, '')) : '');
    if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
    setIsPaid(Boolean(parsed.isPaid));
    setChangeFor(parsed.changeFor ? formatCurrencyInput(parsed.changeFor.replace(/\D/g, '')) : '');
    setDrinks((parsed.drinks || []).join(', '));
    setObservation((parsed.observations || []).join(' - '));

    toast.info('Rascunho carregado da Caixa de Entrada', {
      description:
        'Campos reconhecidos já preenchidos. Revise os dados, escolha a rota se necessária e salve.',
    });
  }, [inboxDay, inboxDraftId]);

  useEffect(() => {
    if (!sameStopSource || sameStopSeeded.current) return;
    sameStopSeeded.current = true;
    setOrigin(sameStopSource.origin === 'loja' ? 'loja' : 'ifood');
    setFulfillmentMode(sameStopSource.fulfillment_mode || 'delivery');
    setRouteId(sameStopSource.route_id || '');
    routeSelectionTouched.current = true;
    setStreetAddress(sameStopSource.address_string || '');
    setMapsLink(sameStopSource.maps_link || '');
    // Endereço e rota podem ser reaproveitados; identidade não é inferida.
    setCustomerName('');
    setSelectedCustomerId('');
    setPhone('');
    setObservation('');
    setSameStopIdentityMode('new');
    setIsParserOpen(false);
    toast.info('Nova entrega na mesma parada', {
      description: 'Rota e endereço prontos. Escolha se é o mesmo cliente ou outra pessoa.',
    });
  }, [sameStopSource]);

  useEffect(() => {
    if (fulfillmentMode !== 'delivery' || routeSelectionTouched.current) return;

    const currentStillEligible =
      routeId && openRoutes.some((route) => route.id === routeId);

    if (currentStillEligible) return;

    if (typeof window !== 'undefined') {
      const rememberedRouteId = readActiveOperationalRouteId();
      const rememberedRoute = openRoutes.find((route) => route.id === rememberedRouteId);
      if (rememberedRoute) {
        setRouteId(rememberedRoute.id);
        return;
      }
    }

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

  const formatPhoneInput = (val: string) => formatBrazilPhone(val);

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
    setActiveDraftId('primary');
    if (!magicText.trim()) { toast.error('Cole o texto do pedido antes de processar.'); return; }
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    const parsedOrdersBase = inboxParsedRef.current
      ? [inboxParsedRef.current]
      : parseIfoodOrdersText(magicText,{
      knownNeighborhoods,
      knownCustomerNames:customers.map(customer=>customer.name),
    });
    const parsedOrders = isFood99 ? parsedOrdersBase.map((item)=>normalizeFood99Order(magicText,item)) : parsedOrdersBase;
    inboxParsedRef.current = null; const parsed=parsedOrders[0]; const identified:string[]=[];
    if(parsed.orderId){setOrderId(parsed.orderId);identified.push(`Nº #${parsed.orderId}`)}
    if(!isFood99 && parsed.ifoodId){setIfoodId(parsed.ifoodId);identified.push(`ID ${parsed.ifoodId}`)}
    if(!isFood99 && parsed.confirmationCode){setConfirmationCode(parsed.confirmationCode);identified.push(`Cód. ${parsed.confirmationCode}`)}
    if(parsed.customerName){
      setCustomerName(parsed.customerName);
      const normalizedParsedName=parsed.customerName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
      const matchedCustomers=customers.filter(customer=>customer.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim()===normalizedParsedName);
      const matchedCustomer=matchedCustomers.length===1?matchedCustomers[0]:undefined;
      const provenCustomer = matchedCustomer && customerIdentityEvidence(matchedCustomer, parsed.customerName, { address: parsed.address, phone: parsed.phone }).reusable ? matchedCustomer : undefined;
      setSelectedCustomerId(provenCustomer?.id || '');
      if(provenCustomer){
        if(!parsed.phone&&provenCustomer.phone)setPhone(formatPhoneInput(provenCustomer.phone));
        if(!parsed.mapsLink&&provenCustomer.maps_link)setMapsLink(provenCustomer.maps_link);
        if(!parsed.address&&provenCustomer.address)setStreetAddress(provenCustomer.address);
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
    if(parsedOrders.length>1){setExtraIfoodOrders(parsedOrders.slice(1).map((item,index)=>({id:`extra-${Date.now()}-${index}-${Math.random().toString(36).slice(2,6)}`,orderId:item.orderId,ifoodId:item.ifoodId,confirmationCode:item.confirmationCode,customerName:item.customerName||parsed.customerName,customerCharge:item.customerCharge||item.value||'',subsidy:item.subsidy,paymentMethod:item.paymentMethod||'dinheiro',isPaid:item.isPaid,changeFor:item.changeFor?formatCurrencyInput(item.changeFor.replace(/\D/g,'')):'',address:item.address||parsed.address,phone:item.phone||'',mapsLink:item.mapsLink||'',drinks:item.drinks.join(', '),observation:item.observations.join(' - '),notifyWhatsapp:false})));identified.push(`${parsedOrders.length} pedidos reconhecidos`)}else setExtraIfoodOrders([]);
    if(!identified.length){toast.error('Nenhum dado reconhecido no texto.');return}
    if(Capacitor.isNativePlatform())void Haptics.impact({style:ImpactStyle.Heavy}).catch(()=>undefined);
    const parseQuality=isFood99
      ? (()=>{const issues=parsedOrders.map((item,index)=>({index,fields:[!/^\d{6}$/.test(item.orderId)?'pedido 99Food':'',!item.customerName?'cliente':''].filter(Boolean)})).filter(item=>item.fields.length>0);return {complete:parsedOrders.length-issues.length,review:issues.length,issues};})()
      : assessIfoodParseQuality(parsedOrders);
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
    if(parseQuality.review===0){setMagicText('');setIsParserOpen(false)}else{setIsParserOpen(true)}
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
    const coords = extractCoordinatesFromUrl(activeMapsLink);
    if (coords || (activeMapsLink && activeMapsLink.includes('http'))) {
      return {
        status: 'precise' as const,
        title: 'Link do Maps vinculado',
        desc: 'A entrega possui uma referência direta do Google Maps.'
      };
    }
    const liveAddressQuality = auditOperationalAddress(
      activeAddress,
      { knownNeighborhoods },
    );
    const hasNumber = !liveAddressQuality.issues.includes('missing-house-number');
    if (activeAddress.trim().length > 3 && hasNumber && !liveAddressQuality.needsReview) {
      return {
        status: 'good' as const,
        title: 'Rua e número informados',
        desc: 'Confira o bairro ou vincule um link do Maps quando houver dúvida.'
      };
    }
    if (activeAddress.trim().length > 0 && !hasNumber) {
      return {
        status: 'warning' as const,
        title: 'Atenção: Sem Número!',
        desc: 'Cole o link do Maps para evitar erros de rota.'
      };
    }
    return null;
  }, [activeAddress, activeMapsLink, knownNeighborhoods]);

  const handleCustomerSelect = (c: Customer, typedQuery?: string) => {
    if (customerPhones(c).length>1 || customerAddresses(c).length>1) { setPendingContactCustomer(c); return; }
    applyCustomerSelection(c,undefined,undefined,typedQuery);
  };
  const applyCustomerSelection = (c:Customer, chosenPhone?:CustomerPhone, chosenAddress?:CustomerAddress, typedQuery?:string) => {
    previousCustomerDraft.current = {
      name: typedQuery || typedCustomerBeforeSelection.current || activeCustomerName,
      phone: activePhone, address: activeAddress, mapsLink: activeMapsLink,
      observation: activeObservation,
    };
    setSelectedCustomerLabel(c.name);
    if (!activeExtra) setSelectedCustomerId(c.id);
    setActiveCustomerName(c.name);
    const address=chosenAddress?.address||c.address;
    if (address) setActiveAddress(address);
    const phone=chosenPhone?.number||c.phone;
    if (phone) setActivePhone(formatPhoneInput(phone));
    if (c.observation) setActiveObservation(c.observation);
    const mapsLink=chosenAddress?.maps_link||c.maps_link;
    if (mapsLink) setActiveMapsLink(mapsLink);
    // A confirmação pertence ao pedido, nunca deve vir automaticamente de outro pedido.
    toast.success('Cliente carregado.');
  };

  const parseMoney = (input:string) => { const parsed=Number(input.replace(/\./g,'').replace(',','.')); return Number.isFinite(parsed)?parsed:0; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(isSyncing && !hasHydrated){toast.info('Aguarde a atualização dos clientes terminar.',{description:'Aguarde a hidratação inicial dos cadastros antes de salvar.'});return}
    // Com dados locais hidratados, sync em segundo plano nao deve bloquear o cadastro.
    // A identidade ainda e revalidada em findOrCreateCustomer antes do Firestore.
    if(!value||(fulfillmentMode==='delivery'&&(!routeId||!streetAddress))){toast.error(fulfillmentMode==='delivery'?'Preencha os campos obrigatórios (Rota, Valor e Rua)':'Informe o valor do pedido');return}
    if(origin==='food99'&&!/^\d{6}$/.test(orderId)){toast.error('Informe o número de 6 dígitos do pedido 99Food.');return}
    if(fulfillmentMode==='delivery'&&!openRoutes.some(route=>route.id===routeId)){toast.error('Selecione uma rota aberta da operação de hoje.');return}
    const drafts=origin==='ifood'?[{id:'primary',orderId,ifoodId,confirmationCode,customerName,customerCharge:value,subsidy:hasIfoodSubsidy?ifoodSubsidy:'',paymentMethod,isPaid,changeFor,address:streetAddress,phone,mapsLink,drinks,observation,notifyWhatsapp},...extraIfoodOrders]:[];
    if (origin === 'ifood') {
      const issue = firstMultiOrderIssue(drafts);
      if (issue) {
        setActiveDraftId(issue.id);
        const messages = {
          order_required: 'Informe o número deste pedido.',
          duplicate_order: 'Número repetido: cada pedido precisa de um número diferente.',
          duplicate_ifood_id: 'ID iFood repetido entre os pedidos.',
          invalid_ifood_id: 'O ID iFood deve ter exatamente oito dígitos.',
          invalid_confirmation: 'O código de confirmação precisa ter quatro dígitos.',
          charge_required: 'Informe o valor individual deste pedido.',
        } as const;
        toast.error(messages[issue.kind], {description:'Aba selecionada para revisão. Nenhum pedido foi salvo.'});
        return;
      }
    }
    if(ownerIdentityAmongDrafts&&!ownerOrderContext){toast.error('Classifique este pedido no seu nome.',{description:'Informe se é teste, pedido real provisório ou retirada real na loja.'});return}
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
      const rawPhone=normalizeBrazilPhone(phone)||normalizedAddress.phone||'';
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
      const shouldGroupStop = Boolean(stopSource);
      const stopGroupId = stopSource?.stop_group_id ||
        (shouldGroupStop
          ? `stop-${stopSource?.id || Date.now()}-${stopSource ? 'linked' : Math.random().toString(36).slice(2, 7)}`
          : undefined);

      if (stopSource && !stopSource.stop_group_id && stopGroupId) {
        await updateDelivery(stopSource.id, { stop_group_id: stopGroupId });
      }

      if(origin==='ifood'){
        const deliveriesToCreate:Delivery[]=[];
        const stopGroups=new Map<string,string>();
        for(let index=0;index<drafts.length;index+=1){const draft=drafts[index];const draftName=draft.customerName.trim()||customerName.trim();const charge=Math.max(0,parseMoney(draft.customerCharge||'0'));const subsidy=Math.max(0,parseMoney(draft.subsidy||''));const draftNormalized=fulfillmentMode==='delivery'?canonicalizeOperationalAddress(draft.address||streetAddress):{address:'',phone:undefined};const draftAddress=draftNormalized.address||cleanStreet;const draftPhone=normalizeBrazilPhone(draft.phone)||draftNormalized.phone||'';const draftMaps=(draft.mapsLink||'').trim()||(index===0?resolvedMapsLink:'');const addressKey=canonicalizeOperationalAddress(draftAddress).address.toLocaleLowerCase('pt-BR');let draftStopGroupId=stopSource&&sameCustomerAddress(stopSource.address_string,draftAddress)?stopGroupId:undefined;if(fulfillmentMode==='delivery'&&drafts.length>1){const sameAddressCount=drafts.filter(item=>sameCustomerAddress(item.address||streetAddress,draftAddress)).length;if(sameAddressCount>1){draftStopGroupId=stopGroups.get(addressKey)||draftStopGroupId||`stop-${Date.now()}-${stopGroups.size}-${Math.random().toString(36).slice(2,7)}`;stopGroups.set(addressKey,draftStopGroupId)}}let customerId='';if(draftName){customerId=await findOrCreateCustomer(draftName,{address:fulfillmentMode==='delivery'?draftAddress:undefined,phone:draftPhone||undefined,mapsLink:fulfillmentMode==='delivery'?draftMaps:undefined,confirmationCode:draft.confirmationCode||undefined,observation:draft.observation.trim()||cleanObservation||undefined,origin,preferredCustomerId:index===0?selectedCustomerId||undefined:undefined})}
          deliveriesToCreate.push({id:index===0?Date.now().toString():`${Date.now()}-${index}-${Math.random().toString(36).slice(2,6)}`,route_id:fulfillmentMode==='delivery'?routeId:'',fulfillment_mode:fulfillmentMode,logistics_provider:fulfillmentMode==='external_delivery'?'ifood':'dfl',stop_group_id:draftStopGroupId,origin,order_id:draft.orderId||undefined,ifood_id:draft.ifoodId||undefined,confirmation_code:draft.confirmationCode||undefined,customer_id:customerId,customer_name:draftName||undefined,exclude_customer_metrics:excludeCustomerMetrics||fulfillmentMode==='counter'||(fulfillmentMode==='pickup'&&!draftName),value:charge+subsidy,customer_charge:charge,ifood_subsidy:subsidy>0?subsidy:undefined,is_paid:draft.isPaid,is_urgent:isUrgent,payment_method:draft.paymentMethod,payment_state:paymentStateForInput(draft.paymentMethod,draft.isPaid),change_for:draft.paymentMethod==='dinheiro'&&!draft.isPaid&&draft.changeFor?parseMoney(draft.changeFor):undefined,address_string:fulfillmentMode==='delivery'?draftAddress:'',maps_link:fulfillmentMode==='delivery'?draftMaps:'',phone:draftPhone||undefined,notify_whatsapp:draft.notifyWhatsapp,observation:(index===0?cleanObservation:draft.observation.trim()||cleanObservation)||undefined,drinks:draft.drinks,createdAt:now,created_at:now,updated_at:now});
          if(ownerOrderContext && hasOwnerIdentity({name:draftName,phone:draftPhone})) Object.assign(deliveriesToCreate[deliveriesToCreate.length-1],ownerContextFlags(ownerOrderContext));
        }
        await addDeliveries(deliveriesToCreate);toast.success(drafts.length>1?`${drafts.length} pedidos cadastrados nos endereços conferidos.`:'Entrega cadastrada com sucesso!');
      }else{
        const customerAddress=fulfillmentMode==='delivery'?cleanStreet:streetAddress.trim();
        let customerId='';if(customerName.trim())customerId=await findOrCreateCustomer(customerName,{address:customerAddress||undefined,phone:rawPhone||undefined,mapsLink:mapsLink.trim()||undefined,observation:cleanObservation||undefined,origin,preferredCustomerId:selectedCustomerId||undefined});
        const cleanValue=parseMoney(value);const subsidy=origin==='food99'&&hasIfoodSubsidy?Math.max(0,parseMoney(ifoodSubsidy)):0;await addDelivery({id:Date.now().toString(),route_id:fulfillmentMode==='delivery'?routeId:'',fulfillment_mode:fulfillmentMode,logistics_provider:fulfillmentMode==='delivery'?'dfl':origin==='food99'?'food99':'dfl',stop_group_id:stopGroupId,origin,order_id:origin==='food99'?orderId:undefined,customer_id:customerId,customer_name:customerName.trim()||undefined,exclude_customer_metrics:excludeCustomerMetrics||fulfillmentMode==='counter'||(fulfillmentMode==='pickup'&&!customerName.trim()),...(ownerOrderContext?ownerContextFlags(ownerOrderContext):{}),value:cleanValue+subsidy,customer_charge:cleanValue,ifood_subsidy:subsidy||undefined,is_paid:isPaid,is_urgent:fulfillmentMode==='delivery'?isUrgent:false,payment_method:paymentMethod,payment_state:paymentStateForInput(paymentMethod,isPaid),change_for:changeFor?parseMoney(changeFor):undefined,address_string:customerAddress,maps_link:mapsLink.trim()||resolvedMapsLink,phone:rawPhone||undefined,notify_whatsapp:notifyWhatsapp,observation:cleanObservation||undefined,drinks,createdAt:now,created_at:now,updated_at:now});toast.success(origin==='food99'?'Pedido 99Food cadastrado sem criar rota DFL.':stopGroupId?'Entrega adicionada à parada existente.':'Entrega cadastrada com sucesso!');
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

      {sameStopSource && (
        <section aria-label="Segundo pedido na mesma parada" className="rounded-[24px] border border-violet-500/35 bg-violet-500/[.07] p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/20 text-violet-300"><UsersRound size={20}/></span>
            <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-violet-300">Mais um pedido · mesma parada</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">Rota e endereço foram mantidos. O cliente não é copiado automaticamente, para evitar duplicação ou associação incorreta.</p></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => {
              setSameStopIdentityMode('same');
              setCustomerName(sameStopSource.customer_name || '');
              setSelectedCustomerId(sameStopSource.customer_id || '');
              setPhone(formatPhoneInput(sameStopSource.phone || ''));
            }} className={`min-h-12 rounded-xl border px-2 text-[11px] font-black ${sameStopIdentityMode === 'same' ? 'border-violet-400/60 bg-violet-500/20 text-violet-200' : 'border-zinc-700 bg-zinc-950/50 text-zinc-300'}`}><UsersRound size={15} className="mx-auto mb-1"/>Mesmo cliente</button>
            <button type="button" onClick={() => {
              setSameStopIdentityMode('new');
              setCustomerName(''); setSelectedCustomerId(''); setPhone('');
            }} className={`min-h-12 rounded-xl border px-2 text-[11px] font-black ${sameStopIdentityMode === 'new' ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-950/50 text-zinc-300'}`}><Plus size={15} className="mx-auto mb-1"/>Outro cliente</button>
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">Pedido novo: valor, forma de pagamento, código e bebidas são preenchidos individualmente.</p>
        </section>
      )}
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
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">01 · Modalidade</p><p className="mt-1 text-sm font-black text-zinc-200">{fulfillmentMode==='delivery'?'Entrega':fulfillmentMode==='external_delivery'?'Entrega pela plataforma':fulfillmentMode==='pickup'?'Retirada na loja':'Balcão / presencial'}</p>{isFood99&&<p className="mt-1 text-[10px] text-amber-300">{fulfillmentMode === 'external_delivery' ? 'A plataforma entrega: sem rota e sem acerto de motoboy.' : 'Entrega DFL: endereço e rota serão necessários.'}</p>}</div>
          {!isFood99&&<button type="button" onClick={()=>setFulfillmentOptionsOpen(v=>!v)} className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-[11px] font-black text-zinc-400">Alterar <ChevronDown size={14} className={fulfillmentOptionsOpen?'rotate-180':''}/></button>}
        </div>
        {fulfillmentOptionsOpen&&(<div className="mt-3 grid grid-cols-3 gap-2">{([['delivery','Entrega',Bike],['pickup','Retirada',ShoppingBag],['counter','Balcão',Store]] as const).map(([mode,label,Icon])=><button key={mode} type="button" onClick={()=>{setFulfillmentMode(mode);setFulfillmentOptionsOpen(false);setIsRouteDropdownOpen(false)}} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-[10px] font-black ${fulfillmentMode===mode?'border-amber-500/45 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-950/30 text-zinc-500'}`}><Icon size={16}/>{label}</button>)}</div>)}
      </section>

      {/* SELETOR DE ORIGEM COMERCIAL */}
      <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/40 p-3"><div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">02 · Origem</p><p className="mt-1 text-sm font-black text-zinc-200">De onde veio o pedido?</p></div><div className="flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-1">
        <button
          type="button"
          onClick={() => { setOrigin('ifood'); setFulfillmentMode(marketplaceModes?.ifood === 'platform' ? 'external_delivery' : 'delivery'); }}
          className={`min-w-0 flex-1 flex items-center justify-center gap-1.5 h-12 rounded-xl px-1 text-[11px] min-[390px]:text-xs font-bold transition-all ${origin === 'ifood' ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Smartphone size={16} className="shrink-0" /> iFood
        </button>
        <button
          type="button"
          onClick={() => {
            setOrigin('food99');
            setFulfillmentMode(marketplaceModes?.food99 === 'dfl' ? 'delivery' : 'external_delivery');
            if (marketplaceModes?.food99 !== 'dfl') setRouteId('');
            setIfoodId('');
            setConfirmationCode('');
            setExtraIfoodOrders([]);
          }}
          className={`min-w-0 flex-1 flex items-center justify-center gap-1.5 h-12 rounded-xl px-1 text-[11px] min-[390px]:text-xs font-bold transition-all ${origin === 'food99' ? 'bg-amber-400 text-zinc-950 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <ShoppingBag size={16} className="shrink-0" /> 99Food
        </button>
        <button
          type="button"
          onClick={() => {
            setOrigin('loja');
            if (fulfillmentMode === 'external_delivery') setFulfillmentMode('delivery');
            setOrderId('');
            setIfoodId('');
            setConfirmationCode('');
            setMagicText('');
          }}
          className={`min-w-0 flex-1 flex items-center justify-center gap-1.5 h-12 rounded-xl px-1 text-[11px] min-[390px]:text-xs font-bold transition-all ${origin === 'loja' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Store size={16} className="shrink-0" /> Loja
        </button>
      </div></section>

      {/* CAIXA DE TEXTO DO PARSER (APENAS QUANDO FOR IFOOD) */}
      {isMarketplace && !isParserOpen && (
        <button
          type="button"
          onClick={() => setIsParserOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 text-xs font-bold text-red-400 active:scale-[0.98]"
        >
          <Sparkles size={15} /> Colar outro pedido do {isFood99 ? '99Food' : 'iFood'}
        </button>
      )}

      {isMarketplace && isParserOpen && (
        <div className={`flex flex-col gap-3 rounded-[24px] border p-3.5 animate-in fade-in ${isFood99 ? 'border-amber-400/25 bg-gradient-to-b from-amber-400/[.08] to-zinc-900/40' : 'border-red-500/20 bg-gradient-to-b from-red-500/10 to-zinc-900/40'}`}>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1.5 text-xs font-bold ${isFood99 ? 'text-amber-300' : 'text-red-400'}`}>
              <Sparkles size={14} className="text-amber-400" /> Leitor inteligente do {isFood99 ? '99Food' : 'iFood'}
            </span>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 bg-zinc-800/90 hover:bg-zinc-700 px-3 py-1 rounded-full active:scale-95 transition-all shadow-sm"
            >
              <ClipboardPaste size={12} className={isFood99 ? 'text-amber-300' : 'text-red-400'} /> Colar do Celular
            </button>
          </div>

          {isFood99 && magicText.trim().length > 0 && (
            <div role="status" className="rounded-2xl border border-amber-400/20 bg-zinc-950/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-amber-300">99Food · dados reconhecidos</p>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">A entrega é feita pela plataforma por padrão. Não exige ID iFood, código de confirmação ou endereço.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ['Pedido', liveParsedOrders[0]?.orderId && /^\d{6}$/.test(liveParsedOrders[0].orderId) ? `#${liveParsedOrders[0].orderId}` : '6 dígitos'],
                  ['Cliente', liveParsedOrders[0]?.customerName || 'Revisar'],
                  ['Pagamento', liveParsedOrders[0]?.paymentMethod || 'Revisar'],
                  ['Valor', liveParsedOrders[0]?.customerCharge || liveParsedOrders[0]?.value || 'Revisar'],
                  ['Bebidas', liveParsedOrders[0]?.drinks?.length ? liveParsedOrders[0].drinks.join(', ') : 'Não identificadas'],
                  ['Observações', liveParsedOrders[0]?.observations?.length ? liveParsedOrders[0].observations.join(' · ') : 'Sem observações'],
                ].map(([label,value]) => <div key={label} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-2.5"><span className="text-[10px] font-black text-amber-200">{label}</span><p className="mt-1 break-words text-[11px] text-zinc-300">{value}</p></div>)}
              </div>
            </div>
          )}
          {!isFood99 && magicText.trim().length > 0 && (
            <div ref={parserGuideRef} aria-busy={parserUpdating} className="dfl-parser-guide sticky top-[calc(var(--dfl-safe-top)+8px)] z-20 rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[.14em] text-zinc-400">Guia de preenchimento</p><span className="text-[9px] font-bold text-zinc-600">fica visível com o teclado</span></div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-zinc-400">Reconhecimento ao vivo</span>
                <span role="status" className="text-[10px] font-bold text-emerald-300">{parserUpdating ? 'Atualizando leitura…' : `${liveRecognition.items.length} dados identificados`}</span>
              </div>
              {liveRecognition.items.length > 0 && (
                <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer py-1">Ver dados reconhecidos</summary><div className="mt-2 flex flex-wrap gap-1.5">
                  {liveRecognition.items.map((item) => (
                    <span key={`${item.key}-${item.label}`} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold ${item.tone==='financial'?'border-amber-500/25 bg-amber-500/[.08] text-amber-200':item.tone==='logistics'?'border-sky-500/25 bg-sky-500/[.08] text-sky-300':item.tone==='attention'?'border-violet-500/25 bg-violet-500/[.08] text-violet-300':'border-emerald-500/20 bg-emerald-500/[.08] text-emerald-300'}`}>
                      <CheckCircle2 size={11} /> {item.label}
                    </span>
                  ))}
                </div></details>
              )}
              {liveRecognition.financial.some((item)=>item.subsidy) && (
                <div className="mt-2 space-y-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[.06] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-amber-300"><TicketPercent size={12}/> Composição do pedido</p>
                  {liveRecognition.financial.filter((item)=>item.subsidy).map((item)=><p key={`financial-${item.index}`} className="text-[10px] leading-relaxed text-zinc-300"><b className="text-zinc-100">{item.title}:</b> cliente paga {item.customerCharge?`R$ ${item.customerCharge}`:'valor não identificado'} + cupom iFood R$ {item.subsidy}{item.total?` = total R$ ${item.total}`:''}</p>)}
                </div>
              )}
              {liveParseQuality.issues.length > 0 && liveRecognition.items.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[.06] px-3 py-2 text-[10px] text-amber-200">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>Falta conferir: {Array.from(new Set(liveParseQuality.issues.flatMap((item) => item.fields))).join(', ')}.</span>
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-1.5 min-[390px]:grid-cols-3">
                {liveGuide.map((item)=><div key={item.key} className={`min-w-0 rounded-xl border px-2.5 py-2 ${item.state==='complete'?'border-emerald-500/25 bg-emerald-500/[.08]':item.state==='partial'?'border-amber-500/25 bg-amber-500/[.07]':'border-zinc-800 bg-zinc-900/55'}`}><div className="flex items-center gap-1.5"><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.state==='complete'?'bg-emerald-400':item.state==='partial'?'bg-amber-400':'bg-zinc-700'}`}/><b className={`truncate text-[11px] ${item.state==='complete'?'text-emerald-300':item.state==='partial'?'text-amber-300':'text-zinc-500'}`}>{item.label}</b><span className="sr-only">{item.state==='complete'?'Identificado':item.state==='partial'?'Incompleto':'Não identificado'}</span></div><p title={item.value||item.hint} className="mt-1 truncate text-[11px] text-zinc-300">{item.value||item.hint}</p>{item.state==='partial'&&item.value&&<p className="mt-1 text-[10px] text-amber-200">{item.hint}</p>}</div>)}
              </div>
              {liveParsedOrders.length>1&&<p className="mt-2 text-[9px] font-bold text-violet-300">{liveParsedOrders.length} pedidos detectados · revisão individual antes de salvar</p>}
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/55 px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-500">{isFood99 ? 'Exemplo 99Food: 123456 · Cliente Maria · Pago no app · R$ 42,00' : 'Modelo iFood: #1234 12345678 · Cliente · Rua, número, bairro · Pago/Pix/Dinheiro'}</div>

          <textarea
            aria-label={isFood99 ? 'Texto do pedido 99Food' : 'Texto do pedido iFood'}
            ref={parserInputRef}
            rows={3}
            placeholder={isFood99 ? 'Cole aqui o pedido 99Food...' : 'Cole aqui o texto do iFood...'}
            value={magicText}
            onChange={(e) => setMagicText(e.target.value)}
            onFocus={()=>window.setTimeout(()=>parserInputRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),180)}
            className={`w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none resize-none font-mono ${isFood99 ? 'focus:border-amber-400/50' : 'focus:border-red-500/50'}`}
          />

          <button
            type="button"
            onClick={handleExecuteMagicParse}
            className={`min-h-11 w-full rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all ${isFood99 ? 'bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/10' : 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'}`}
          >
            <Sparkles size={15} />
            {isFood99 ? 'Preencher pedido 99Food' : liveParseQuality.review > 0 && liveRecognition.items.length > 0
              ? 'Preencher e revisar o que falta'
              : 'Revisar e preencher pedido'}
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
                  onClick={() => { routeSelectionTouched.current = true; setRouteId(r.id); rememberActiveOperationalRouteId(r.id); setIsRouteDropdownOpen(false); }}
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
        {origin === 'ifood' && extraIfoodOrders.length > 0 && (
          <section className="rounded-[22px] border border-violet-500/25 bg-violet-500/[.055] p-3" aria-label="Pedidos na mesma parada">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-violet-300">Mesma parada · {extraIfoodOrders.length + 1} pedidos</p><p className="mt-1 text-[10px] text-zinc-400">Toque no número para editar cada pedido. Salve todos no final.</p></div>
              <UsersRound size={16} className="shrink-0 text-violet-300" />
            </div>
            <div role="tablist" aria-label="Alternar pedido da parada" className="flex gap-2 overflow-x-auto pb-1">
              {([{id:'primary',orderId}, ...extraIfoodOrders] as Array<{id:string;orderId:string}>).map((draft, index) => (
                <button type="button" key={draft.id} role="tab" aria-selected={activeDraftId === draft.id}
                  onClick={() => setActiveDraftId(draft.id)}
                  className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${activeDraftId === draft.id ? 'border-violet-400/60 bg-violet-400/15 text-violet-200' : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'}`}>
                  #{draft.orderId || `Pedido ${index + 1}`}
                </button>
              ))}
            </div>
          </section>
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
                value={activeOrderId}
                onChange={(e) => setActiveOrderId(e.target.value.replace(/\D/g, '').slice(0, 5))}
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
                value={activeIfoodId}
                onChange={(e) => setActiveIfoodId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className={`h-12 rounded-xl border bg-zinc-900/50 px-3 text-sm text-zinc-100 focus:outline-none ${activeIfoodId.length > 0 && activeIfoodId.length < 8 ? 'border-amber-500' : 'border-zinc-800 focus:border-emerald-500'}`}
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
                value={activeConfirmationCode}
                onChange={(e) => setActiveConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={`h-12 rounded-xl border bg-zinc-900/50 px-3 text-sm text-zinc-100 font-mono font-bold tracking-widest focus:outline-none ${activeConfirmationCode.length > 0 && activeConfirmationCode.length < 4 ? 'border-amber-500' : 'border-zinc-800 focus:border-emerald-500'}`}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div><p className="text-[11px] font-black text-zinc-200">Mais pedidos neste endereço?</p><p className="mt-0.5 text-[10px] text-zinc-600">Uma parada física; clientes, IDs e códigos ficam separados.</p></div>
            <button type="button" onClick={() => {
              const id=`manual-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
              setExtraIfoodOrders(current => [...current, {id,orderId:'',ifoodId:'',confirmationCode:'',customerName:activeCustomerName,customerCharge:'',subsidy:'',paymentMethod:activePaymentMethod,isPaid:false,changeFor:'',address:activeAddress,phone:activePhone,mapsLink:activeMapsLink,drinks:'',observation:activeObservation,notifyWhatsapp:false}]);
              setActiveDraftId(id);
            }} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 text-[10px] font-black text-violet-300"><Plus size={13}/> Adicionar</button>
          </div>
          {activeExtra && <button type="button" onClick={() => {setExtraIfoodOrders(current => current.filter(draft => draft.id !== activeDraftId));setActiveDraftId('primary');}} className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[.06] px-3 text-[11px] font-bold text-red-300"><Trash2 size={14}/> Remover somente este pedido</button>}
          </section>
        )}

        {origin === 'food99' && (
          <section className="rounded-[24px] border border-amber-400/25 bg-amber-400/[.055] p-4 animate-in fade-in">
            <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">04 · Identificador 99Food</p><p className="mt-1 text-[11px] text-zinc-500">Somente o número comercial de seis dígitos. Não existe código iFood.</p></div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-amber-200">Nº do pedido*</span>
              <input type="text" inputMode="numeric" placeholder="Ex: 123456" maxLength={6} value={orderId} onChange={(event)=>setOrderId(event.target.value.replace(/\D/g,'').slice(0,6))} className={`h-12 rounded-xl border-2 bg-zinc-900/80 px-3 text-base font-black tracking-wider text-zinc-50 outline-none ${orderId.length===6?'border-emerald-500/50':'border-amber-400/45 focus:border-amber-300'}`} required />
            </label>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-zinc-950/40 p-3 text-[10px] leading-relaxed text-zinc-400"><ShoppingBag size={15} className="mt-0.5 shrink-0 text-amber-300"/><span>Venda e cliente entram nos relatórios. Logística, parada e produtividade ficam atribuídas à <strong className="text-amber-200">99Food</strong>, não ao motoboy DFL.</span></div>
          </section>
        )}

        {/* CLIENTE E WHATSAPP */}
        <section className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">05 · Cliente</p><p className="mt-1 text-sm font-black text-zinc-200">Contato e identificação</p></div>
          <CustomerAutocomplete
            value={activeCustomerName}
            onChange={(nextName) => {
              typedCustomerBeforeSelection.current = nextName;
              if (!activeExtra && selectedCustomerId) {
                setSelectedCustomerId('');
                setSelectedCustomerLabel('');
              }
              setActiveCustomerName(nextName);
            }}
            onSelect={handleCustomerSelect}
            customers={customers}
          />
          {selectedCustomerLabel && !activeExtra && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.06] px-3 py-2">
              <div className="min-w-0"><p className="truncate text-[11px] font-bold text-amber-200">Selecionado: {selectedCustomerLabel}</p><p className="text-[10px] text-zinc-400">Confira a identidade; bairro igual não significa mesmo cliente.</p></div>
              <button type="button" className="min-h-10 shrink-0 rounded-lg border border-zinc-600 px-3 text-[11px] font-bold text-zinc-100" onClick={() => {
                const before = previousCustomerDraft.current;
                setSelectedCustomerId(''); setSelectedCustomerLabel('');
                setCustomerName(before?.name || '');
                setPhone(before?.phone || '');
                setStreetAddress(before?.address || '');
                setMapsLink(before?.mapsLink || '');
                setObservation(before?.observation || '');
                toast.info('Seleção desfeita. Continue com o nome digitado.');
              }}>Desfazer escolha</button>
            </div>
          )}
          {customerIdentity && (
            <div className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${customerIdentity.kind === 'existing' ? 'border-emerald-500/25 bg-emerald-500/[.07] text-emerald-300' : customerIdentity.kind === 'multiple' || customerIdentity.kind === 'same_address' ? 'border-amber-500/25 bg-amber-500/[.07] text-amber-300' : 'border-violet-500/25 bg-violet-500/[.07] text-violet-300'}`}>
              {customerIdentity.kind === 'existing'
                ? `Cliente encontrado: ${customerIdentity.customer?.name}. Nome e identidade são compatíveis; o cadastro será reutilizado.`
                : customerIdentity.kind === 'multiple'
                  ? `${customerIdentity.count} clientes compatíveis encontrados. Escolha um para evitar associação errada.`
                  : customerIdentity.kind === 'same_address'
                    ? `${customerIdentity.count} cliente(s) já usam este endereço, mas o nome não confere. Será mantido como pessoa diferente até você selecionar alguém manualmente.`
                    : 'Cliente novo: será cadastrado com os dados deste pedido.'}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                inputMode="tel"
                placeholder="WhatsApp: (34) 99999-9999"
                value={activePhone}
                onChange={(e) => setActivePhone(formatPhoneInput(e.target.value))}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveNotifyWhatsapp(!activeNotifyWhatsapp);
              }}
              className={`flex items-center gap-1.5 h-12 px-4 rounded-xl border text-xs font-bold transition-all active:scale-95 shrink-0 ${
                activeNotifyWhatsapp
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
            value={activeAddress}
            onChange={setActiveAddress}
            onMapsLinkDetected={setActiveMapsLink}
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
              value={activeMapsLink}
              onChange={(e) => setActiveMapsLink(e.target.value)}
              className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <LocationEvidencePreview address={activeAddress} mapsLink={activeMapsLink} sourceLabel={origin==='ifood'?'iFood':origin==='food99'?'99Food':'Loja'}/>
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
              <label className="text-xs font-bold text-zinc-300">{isMarketplace&&activeHasSubsidy?'Cliente paga (R$)*':'Valor (R$)*'}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={activeValue}
                onChange={(e) => setActiveValue(formatCurrencyInput(e.target.value))}
                className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xl font-bold text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Bebidas</label>
              <input
                type="text"
                placeholder="Ex: 1 Coca 2L"
                value={activeDrinks}
                onChange={(e) => setActiveDrinks(e.target.value)}
                className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {isMarketplace&&(<div className="rounded-2xl border border-zinc-800 bg-zinc-950/35 p-3"><button type="button" onClick={()=>{activeExtra ? updateActiveExtra({subsidy:activeHasSubsidy?'':'0,00'}) : (setHasIfoodSubsidy(v=>!v), activeHasSubsidy && setIfoodSubsidy(''))}} className="flex w-full items-center justify-between gap-3 text-left"><span className="flex items-center gap-2"><TicketPercent size={15} className={activeHasSubsidy?'text-emerald-400':'text-zinc-600'}/><span><strong className="block text-[11px] text-zinc-300">Cupom / subsídio do {isFood99?'99Food':'iFood'}</strong><span className="text-[9px] text-zinc-600">Registra o valor coberto pela plataforma sem alterar a cobrança do cliente.</span></span></span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${activeHasSubsidy?'bg-emerald-500/10 text-emerald-400':'bg-zinc-800 text-zinc-500'}`}>{activeHasSubsidy?'Ativo':'Adicionar'}</span></button>{activeHasSubsidy&&(
            <div className="mt-3 grid grid-cols-2 items-stretch gap-2">
              <label className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/45 p-2.5">
                <span className="text-[9px] font-black uppercase tracking-wide text-zinc-500">
                  {isFood99?'99Food':'iFood'} cobre
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={activeSubsidy}
                  onChange={e=>setActiveSubsidy(formatCurrencyInput(e.target.value))}
                  className="mt-1 h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/55 px-3 text-base font-black text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>

              <div className="flex min-w-0 flex-col justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[.055] p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wide text-emerald-500">
                  Total do pedido
                </p>
                <p className="mt-1 truncate text-base font-black text-zinc-100">
                  R$ {(parseMoney(activeValue)+parseMoney(activeSubsidy)).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                </p>
                <p className="mt-0.5 truncate text-[8px] font-bold text-zinc-600">
                  Cliente {parseMoney(activeValue).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </p>
              </div>
            </div>
          )}</div>)}

          <div className={`flex flex-col gap-2 transition-all duration-300 ${activeIsPaid ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <label className="text-xs font-semibold text-zinc-400">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => { setActivePaymentMethod('dinheiro'); setActiveIsPaid(false); }} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${activePaymentMethod === 'dinheiro' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <Banknote size={20} />
                <span className="text-xs font-bold">Dinheiro</span>
              </button>
              <button type="button" onClick={() => setActivePaymentMethod('pix')} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${activePaymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <QrCode size={20} />
                <span className="text-xs font-bold">Pix</span>
              </button>
              <button type="button" onClick={() => { setActivePaymentMethod('cartao'); setActiveIsPaid(false); }} className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 transition-all ${(activePaymentMethod as string) === 'cartao' ? 'border-sky-500 bg-sky-500/10 text-sky-500' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>
                <CreditCard size={20} />
                <span className="text-xs font-bold">Cartão</span>
              </button>
            </div>
          </div>

          {activePaymentMethod === 'pix' && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-200">Pago antecipado?</span>
                <span className="text-[10px] text-zinc-500">Marque quando o Pix já foi recebido</span>
              </div>
              <button type="button" onClick={() => setActiveIsPaid(!activeIsPaid)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${activeIsPaid ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${activeIsPaid ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {activePaymentMethod === 'dinheiro' && !activeIsPaid && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Troco para (R$)</label>
              <input type="text" inputMode="numeric" placeholder="Ex: 50,00" value={activeChangeFor} onChange={(e) => setActiveChangeFor(formatCurrencyInput(e.target.value))} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400">Observação / Portão / Complemento</label>
            <input type="text" placeholder="Ex: Ap. 11B, Portão preto..." value={activeObservation} onChange={(e) => setActiveObservation(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
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


        {ownerIdentityAmongDrafts && <section className="rounded-[24px] border border-sky-500/25 bg-sky-500/[.055] p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-400">Identidade da loja detectada</p><p className="mt-1 text-sm font-black text-zinc-100">Como este lançamento deve contar?</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Isso separa testes de vendas reais sem apagar faturamento legítimo.</p><div className="mt-3 grid gap-2">{([['owner_test','DEV / teste','Sai dos relatórios, ranking e fidelidade.'],['owner_provisional','Pedido real provisório','Conta na venda e operação; não vira pedido do Álefe.'],['store_pickup','Retirada real na loja','Conta normalmente; vincule ao cliente verdadeiro.']] as const).map(([context,label,description])=><button key={context} type="button" onClick={()=>setOwnerOrderContext(context)} className={`rounded-2xl border p-3 text-left ${ownerOrderContext===context?'border-sky-400/50 bg-sky-500/10':'border-zinc-800 bg-zinc-950/40'}`}><b className="block text-xs text-zinc-100">{label}</b><span className="mt-1 block text-[10px] text-zinc-500">{description}</span></button>)}</div></section>}

        <button type="button" onClick={() => setExcludeCustomerMetrics(v => !v)} className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left ${excludeCustomerMetrics ? 'border-violet-500/30 bg-violet-500/[.08]' : 'border-zinc-800 bg-zinc-900/45'}`}>
          <span className="mt-0.5">{excludeCustomerMetrics ? <CheckCircle2 size={16} className="text-violet-400"/> : <span className="block h-4 w-4 rounded border border-zinc-700"/>}</span>
          <span><b className="block text-xs text-zinc-200">Pedido operacional / não contar como cliente</b><small className="mt-1 block text-[10px] leading-relaxed text-zinc-500">Use para retirada de balcão ou lançamento interno. A venda continua no financeiro, mas não altera ranking, frequência ou benefícios do cliente.</small></span>
        </button>

        <button type="submit" disabled={isSaving} className="mt-2 h-14 w-full rounded-2xl bg-amber-500 font-bold text-zinc-950 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-amber-500/20 transition-all">
          {isSaving ? 'Salvando...' : extraIfoodOrders.length ? `Salvar ${extraIfoodOrders.length + 1} pedidos` : 'Salvar entrega'}
        </button>
      </form>
      {pendingContactCustomer&&<CustomerDestinationSheet customer={pendingContactCustomer} onClose={()=>setPendingContactCustomer(null)} onConfirm={(phone,address)=>{applyCustomerSelection(pendingContactCustomer,phone,address);setPendingContactCustomer(null);}}/>}
    </div>
  );
}

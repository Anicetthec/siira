import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { pendingCount, queueRequest, syncQueue } from './offline';

type Module = 'dashboard' | 'trips' | 'sales' | 'baggage' | 'agencies' | 'fleet' | 'finance';
type Baggage = { trackingCode: string; description: string; weightKg: number; status: string; note?: string; ticket: { reference: string; customer: { fullName: string; phone: string }; trip: { route: { departureCity: string; arrivalCity: string } } } };
type SaleTrip = { id: string; time: string; route: string; vehicle: string; sold: number; seats: number; status: string; availableSeatId?: string; availableSeatNumber?: string; price?: number };

const initialTrips = [
  { id: 'demo-1', time: '07:00', route: 'Ouagadougou → Bobo-Dioulasso', vehicle: 'BF 3021 AB', sold: 44, seats: 50, status: 'Embarquement' },
  { id: 'demo-2', time: '09:30', route: 'Ouagadougou → Koudougou', vehicle: 'BF 1847 AC', sold: 32, seats: 50, status: 'Planifié' },
  { id: 'demo-3', time: '11:00', route: 'Bobo-Dioulasso → Ouagadougou', vehicle: 'BF 2088 AA', sold: 23, seats: 50, status: 'Planifié' },
];

const money = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount);

function App() {
  const [active, setActive] = useState<Module>('dashboard');
  const [trips, setTrips] = useState<SaleTrip[]>(initialTrips);
  const [baggage, setBaggage] = useState<Baggage[]>([]);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'trip' | 'sale' | 'baggage' | 'scan' | 'help' | 'profile' | 'login' | null>(null);
  const [tripPeriod, setTripPeriod] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [loginError, setLoginError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncQueue().then((count) => setPending(count));
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    fetch('https://siira-api.onrender.com/api/trips')
      .then(async (response) => {
        if (!response.ok) throw new Error('API trips unavailable');
        return response.json() as Promise<Array<{ id: string; departureAt: string; price: number; route: { departureCity: string; arrivalCity: string }; vehicle: { registration: string; seatCount: number }; seats: Array<{ id: string; number: string }>; _count: { tickets: number }; status: string }>>;
      })
      .then((apiTrips) => {
        if (apiTrips.length === 0) return;
        setTrips(apiTrips.map((trip) => ({
          id: trip.id,
          time: new Date(trip.departureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          route: `${trip.route.departureCity} → ${trip.route.arrivalCity}`,
          vehicle: trip.vehicle.registration,
          sold: trip._count.tickets,
          seats: trip.vehicle.seatCount,
          status: trip.status === 'BOARDING' ? 'Embarquement' : 'Planifié',
          availableSeatId: trip.seats[0]?.id,
          availableSeatNumber: trip.seats[0]?.number,
          price: trip.price,
        })));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch('https://siira-api.onrender.com/api/baggage')
      .then(async (response) => {
        if (!response.ok) throw new Error('API baggage unavailable');
        return response.json() as Promise<Baggage[]>;
      })
      .then(setBaggage)
      .catch(() => undefined);
  }, []);

  const title = useMemo(() => ({
    dashboard: ['Vue d’ensemble', 'Bonjour, votre activité en un coup d’œil.'],
    trips: ['Voyages', 'Planifiez et suivez les départs de vos agences.'],
    sales: ['Ventes & billets', 'Enregistrez une vente au guichet ou retrouvez un billet.'],
    baggage: ['Bagages', 'Enregistrez, localisez et remettez les bagages des voyageurs.'],
    agencies: ['Agences & guichets', 'Pilotez vos points de vente au Burkina Faso.'],
    fleet: ['Flotte', 'Véhicules et capacité disponibles.'],
    finance: ['Revenus', 'Suivez les encaissements et les frais de service.'],
  } as Record<Module, string[]>)[active], [active]);

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setTrips((current) => [...current, {
      id: `local-${crypto.randomUUID()}`,
      time: String(form.get('time')),
      route: `${form.get('departure')} → ${form.get('arrival')}`,
      vehicle: String(form.get('vehicle')),
      sold: 0,
      seats: Number(form.get('seats')),
      status: 'Planifié',
    }]);
    setModal(null);
    notify('Voyage créé et publié aux agences.');
  }

  function printReceipt(title: string, content: string) {
    const receipt = window.open('', '_blank', 'width=480,height=700');
    if (!receipt) {
      notify('Autorisez les fenêtres pop-up pour imprimer le reçu.');
      return;
    }
    receipt.document.write(`<html lang="fr"><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17221e}h1{font-size:20px;border-bottom:2px solid #f2a900;padding-bottom:12px}p{line-height:1.6;border-bottom:1px dashed #ccc;padding-bottom:10px}</style></head><body>${content}<script>window.onload=()=>window.print();</script></body></html>`);
    receipt.document.close();
  }

  function sellTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trip = trips.find((item) => item.id === form.get('tripId'));
    if (!trip?.availableSeatId) {
      notify('Aucune place disponible pour ce voyage.');
      return;
    }
    void fetch('https://siira-api.onrender.com/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: trip.id, seatId: trip.availableSeatId, fullName: form.get('fullName'), phone: form.get('phone'), paymentProvider: form.get('paymentProvider'), counterId: 'GUICHET-CENTRAL', requestId: crypto.randomUUID() }),
    }).then(async (response) => {
      const result = await response.json().catch(() => null) as { reference?: string; message?: string; amount?: number; seat?: { number: string }; trip?: { route: { departureCity: string; arrivalCity: string } } } | null;
      if (!response.ok || !result?.reference) throw new Error(result?.message ?? 'Vente impossible');
      setModal(null);
      notify(`Billet ${result.reference} confirmé.`);
      printReceipt('Reçu de billet', `<h1>Siira · Reçu de billet</h1><p><b>Référence :</b> ${result.reference}</p><p><b>Passager :</b> ${form.get('fullName')}<br><b>Téléphone :</b> ${form.get('phone')}</p><p><b>Trajet :</b> ${result.trip?.route.departureCity ?? trip.route}<br><b>Place :</b> ${result.seat?.number ?? trip.availableSeatNumber}</p><p><b>Montant :</b> ${money(result.amount ?? trip.price ?? 0)} FCFA</p><p>Présentez ce reçu au guichet Siira.</p>`);
    }).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Vente impossible.'));
  }

  async function registerBaggage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({ ticketReference: form.get('ticketReference'), description: form.get('description'), weightKg: Number(form.get('weightKg')), note: form.get('note') || undefined, requestId: crypto.randomUUID() });
    try {
      if (!online) throw new Error('offline');
      const response = await fetch('https://siira-api.onrender.com/api/baggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(error?.message ?? 'Enregistrement impossible');
      }
      const created = await response.json() as Baggage;
      setBaggage((current) => [created, ...current]);
      setModal(null);
      notify(`Bagage enregistré : ${created.trackingCode}.`);
      printReceipt('Reçu bagage', `<h1>Siira · Reçu bagage</h1><p><b>Code de suivi :</b> ${created.trackingCode}</p><p><b>Billet :</b> ${created.ticket.reference}<br><b>Voyageur :</b> ${created.ticket.customer.fullName}<br><b>Trajet :</b> ${created.ticket.trip.route.departureCity} → ${created.ticket.trip.route.arrivalCity}</p><p><b>Bagage :</b> ${created.description}<br><b>Poids :</b> ${created.weightKg} kg</p><p>Conservez ce reçu pour le retrait du bagage.</p>`);
    } catch (error) {
      if (!online) {
        queueRequest({ url: 'https://siira-api.onrender.com/api/baggage', method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        setPending(pendingCount());
        setModal(null);
        notify('Bagage enregistré hors ligne. Synchronisation automatique au retour du réseau.');
      } else notify(error instanceof Error ? error.message : 'Impossible d’enregistrer le bagage.');
    }

  }

  async function updateBaggageStatus(trackingCode: string, status: string) {
    try {
      const body = JSON.stringify({ status });
      if (!online) throw new Error('offline');
      const response = await fetch(`https://siira-api.onrender.com/api/baggage/${encodeURIComponent(trackingCode)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) throw new Error('Mise à jour impossible');
      const updated = await response.json() as Baggage;
      setBaggage((current) => current.map((item) => item.trackingCode === trackingCode ? updated : item));
      notify(`Statut du bagage ${trackingCode} mis à jour.`);
    } catch {
      if (!online) {
        queueRequest({ url: `https://siira-api.onrender.com/api/baggage/${encodeURIComponent(trackingCode)}/status`, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        setPending(pendingCount());
        notify('Mise à jour enregistrée hors ligne. Elle sera synchronisée au retour du réseau.');
      } else notify('Le statut n’a pas pu être mis à jour.');
    }
  }

  function exportReport() {
    const rows = ['Heure,Trajet,Véhicule,Vendus,Capacité,Statut', ...trips.map((trip) => `${trip.time},"${trip.route}",${trip.vehicle},${trip.sold},${trip.seats},${trip.status}`)];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = 'siira-rapport-voyages.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    notify('Rapport CSV téléchargé.');
  }

  async function scanTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = String(new FormData(event.currentTarget).get('reference') ?? '').trim();
    if (!reference) return;
    try {
      const lookup = await fetch(`https://siira-api.onrender.com/api/tickets/${encodeURIComponent(reference)}`);
      if (!lookup.ok) throw new Error('Billet introuvable');
      const ticket = await lookup.json() as { qrToken: string; seat: { number: string } };
      const board = await fetch(`https://siira-api.onrender.com/api/tickets/${encodeURIComponent(reference)}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: ticket.qrToken }),
      });
      if (!board.ok) {
        const error = await board.json().catch(() => null) as { message?: string } | null;
        throw new Error(error?.message ?? 'Billet non valide');
      }

      setModal(null);
      notify(`Billet valide · place ${ticket.seat.number} · embarquement enregistré.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Impossible de contrôler ce billet.');
    }

  }

  async function loginCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('https://siira-api.onrender.com/api/auth/societe/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    const result = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) {
      setLoginError(Array.isArray(result?.message) ? result.message.join(', ') : result?.message ?? 'Connexion impossible');
      return;
    }
    setLoginError('');
    setAuthenticated(true);
    notify('Connexion société réussie.');
  }

  if (!authenticated) {
    return <LoginScreen error={loginError} onSubmit={loginCompany} />;
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><img src="/siira-logo.svg" alt="Siira" /><strong>Siira</strong></div>
        <p className="muted">Espace société</p>
        <nav>{([
          ['dashboard', '▦', 'Vue d’ensemble'], ['trips', '◷', 'Voyages'], ['sales', '▤', 'Ventes & billets'], ['baggage', '▣', 'Bagages'],
          ['agencies', '⌂', 'Agences & guichets'], ['fleet', '▱', 'Flotte'], ['finance', '₣', 'Revenus'],
        ] as [Module, string, string][]).map(([id, icon, label]) => (
          <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><i>{icon}</i>{label}</button>
        ))}</nav>
        <div className="company-card"><small>SOCIÉTÉ CONNECTÉE SUR SIIRA</small><strong>Rakieta Transport</strong><span>Ouagadougou · Abonnement actif</span></div>
      </aside>
      <section className="content">
        <header><div><p className="eyebrow">JEUDI 06 NOVEMBRE 2026 · AFRIQUE/Ouagadougou</p><h1>{title[1]}</h1><p className="subheading">{active !== 'dashboard' && title[0]}</p><p className="offline-status">{online ? 'En ligne' : 'Hors ligne'}{pending > 0 ? ` · ${pending} opération(s) en attente` : ''}</p></div><div className="header-actions"><button className="outline" onClick={() => setModal('help')}>Aide</button><button className="outline" onClick={() => setModal('profile')}>Mon profil</button><button className="outline" onClick={() => setModal('scan')}>▣ Scanner un billet</button><button onClick={() => setModal('trip')}>+ Créer un voyage</button></div></header>
        {notice && <div className="toast">✓ {notice}</div>}
        {active === 'dashboard' && <Dashboard trips={trips} onSale={() => setModal('sale')} onExport={exportReport} onManage={(name) => notify(`Gestion de l’agence ${name} ouverte.`)} onViewAll={() => setActive('trips')} />}
        {active === 'trips' && <Trips trips={trips} onCreate={() => setModal('trip')} period={tripPeriod} onPeriodChange={setTripPeriod} />}
        {active === 'sales' && <Sales onSale={() => setModal('sale')} onScan={() => setModal('scan')} />}
        {active === 'baggage' && <BaggagePage baggage={baggage} onRegister={() => setModal('baggage')} onUpdateStatus={updateBaggageStatus} />}
        {active === 'agencies' && <Agencies onManage={(name) => notify(`Gestion de l’agence ${name} ouverte.`)} />}
        {active === 'fleet' && <Fleet onView={(registration) => notify(`Fiche du véhicule ${registration} ouverte.`)} />}
        {active === 'finance' && <Finance />}
      </section>
      {modal === 'trip' && <Modal title="Créer un voyage" close={() => setModal(null)}><form className="form" onSubmit={createTrip}><div className="form-grid"><label>Départ<input name="departure" defaultValue="Ouagadougou" required /></label><label>Arrivée<input name="arrival" placeholder="Bobo-Dioulasso" required /></label><label>Heure<input name="time" type="time" defaultValue="14:00" required /></label><label>Places<input name="seats" type="number" defaultValue="50" min="10" required /></label><label className="full">Véhicule<select name="vehicle"><option>BF 3021 AB · Autocar 50 places</option><option>BF 1847 AC · Autocar 50 places</option></select></label></div><button type="submit">Publier le voyage</button></form></Modal>}
      {modal === 'sale' && <Modal title="Nouvelle vente guichet" close={() => setModal(null)}><form className="form" onSubmit={sellTicket}><label>Voyage<select name="tripId" required>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.time} · {trip.route}{trip.availableSeatNumber ? ` · place ${trip.availableSeatNumber}` : ''}</option>)}</select></label><div className="form-grid"><label>Nom du passager<input name="fullName" required placeholder="Nom complet" /></label><label>Téléphone<input name="phone" required placeholder="70 00 00 00" /></label><label>Paiement<select name="paymentProvider"><option value="ORANGE_MONEY">Orange Money</option><option value="MOOV_MONEY">Moov Money</option><option value="TELECEL_MONEY">Telecel Money</option><option value="WAVE">Wave</option><option value="CASH">Espèces</option></select></label></div><div className="amount">Prix du billet <strong>Le tarif du voyage sera appliqué</strong></div><button type="submit">Confirmer la vente et imprimer</button></form></Modal>}
      {modal === 'baggage' && <Modal title="Enregistrer un bagage" close={() => setModal(null)}><form className="form" onSubmit={registerBaggage}><label>Référence du billet<input name="ticketReference" placeholder="FT-2026-00482" required /></label><div className="form-grid"><label>Description<input name="description" placeholder="Valise noire" required /></label><label>Poids (kg)<input name="weightKg" type="number" min="1" max="100" required /></label></div><label>Note (facultatif)<input name="note" placeholder="Fragile, à remettre à l’arrivée..." /></label><button type="submit">Créer le suivi bagage</button></form></Modal>}
      {modal === 'scan' && <Modal title="Contrôle d’embarquement" close={() => setModal(null)}><form className="scanner" onSubmit={scanTicket}><div className="qr">▦</div><strong>Scanner le QR code du billet</strong><p>Positionnez le code devant la caméra ou saisissez la référence.</p><input name="reference" placeholder="FT-2026-00482" required /><button type="submit">Valider le billet</button></form></Modal>}
      {modal === 'help' && <Modal title="Aide Siira" close={() => setModal(null)}><p>Support société : <strong>70 00 00 00</strong>, du lundi au samedi de 7h à 22h.</p><button onClick={() => setModal(null)}>Fermer</button></Modal>}
      {modal === 'profile' && <Modal title="Profil de la société" close={() => setModal(null)}><p><strong>Rakieta Transport</strong><br />Code compagnie : RAK<br />Compte administrateur actif.</p><button onClick={() => setModal(null)}>Fermer</button></Modal>}
    </main>
  );
}

function LoginScreen({ error, onSubmit }: { error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand"><img src="/siira-logo.svg" alt="Siira" /><strong>Siira</strong></div>
        <p className="login-eyebrow">ESPACE SOCIÉTÉ</p>
        <h1>Bienvenue sur votre espace</h1>
        <p className="login-intro">Connectez-vous pour gérer vos voyages, vos ventes et vos agences.</p>
        <form className="form login-form" onSubmit={(event) => void onSubmit(event)}>
          <label>Email professionnel<input name="email" type="email" placeholder="admin@rakieta.bf" autoComplete="email" required /></label>
          <label>Mot de passe<input name="password" type="password" placeholder="Votre mot de passe" autoComplete="current-password" minLength={8} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit">Se connecter</button>
        </form>
        <p className="login-help">Besoin d’aide ? Contactez le support Siira au <strong>70 00 00 00</strong>.</p>
      </section>
      <aside className="login-aside">
        <div className="login-aside-content"><span className="login-mark">S</span><h2>Pilotez votre activité transport simplement.</h2><p>Une plateforme pensée pour les sociétés de transport au Burkina Faso.</p></div>
      </aside>
    </main>
  );
}

function Dashboard({ trips, onSale, onExport, onManage, onViewAll }: { trips: typeof initialTrips; onSale: () => void; onExport: () => void; onManage: (name: string) => void; onViewAll: () => void }) {
  return <><div className="stats"><Stat label="Ventes du jour" value="284" trend="+12,4% cette semaine" /><Stat label="Chiffre d’affaires" value="1 420 000" unit="FCFA" trend="+8,7% cette semaine" /><Stat label="Voyages aujourd’hui" value="18" trend="4 en embarquement" /><Stat label="Places disponibles" value="326" trend="sur 612 places" /></div><div className="quick-actions"><button onClick={onSale}>＋ Vente au guichet</button><button onClick={onExport}>⇩ Exporter le rapport journalier</button><span>Dernière synchronisation : il y a 2 min · Mode connecté</span></div><div className="grid"><TripTable trips={trips} onViewAll={onViewAll} /><Agencies onManage={onManage} /></div></>;
}

function Stat({ label, value, unit, trend }: { label: string; value: string; unit?: string; trend: string }) {
  return <article className="stat"><span>{label}</span><strong>{value} <small>{unit}</small></strong><small className={trend.startsWith('+') ? 'positive' : ''}>{trend}</small></article>;
}

function TripTable({ trips, onViewAll }: { trips: typeof initialTrips; onViewAll?: () => void }) {
  return <article className="panel wide"><div className="panel-title"><div><h2>Prochains départs</h2><p>Suivi des voyages de votre compagnie</p></div>{onViewAll && <button className="link-button" onClick={onViewAll}>Voir tout</button>}</div><table><thead><tr><th>Départ</th><th>Destination</th><th>Véhicule</th><th>Remplissage</th><th>Statut</th></tr></thead><tbody>{trips.map((trip) => <tr key={`${trip.time}-${trip.route}`}><td><strong>{trip.time}</strong></td><td>{trip.route}</td><td>{trip.vehicle}</td><td><div className="bar"><i style={{ width: `${Math.min(100, (trip.sold / trip.seats) * 100)}%` }} /></div><small>{trip.sold} / {trip.seats}</small></td><td><b className={`badge ${trip.status === 'Embarquement' ? 'green' : 'blue'}`}>{trip.status}</b></td></tr>)}</tbody></table></article>;
}

function Trips({ trips, onCreate, period, onPeriodChange }: { trips: typeof initialTrips; onCreate: () => void; period: 'today' | 'tomorrow' | 'week'; onPeriodChange: (period: 'today' | 'tomorrow' | 'week') => void }) {
  return <><div className="toolbar"><div className="tabs"><button className={period === 'today' ? 'selected' : ''} onClick={() => onPeriodChange('today')}>Aujourd’hui</button><button className={period === 'tomorrow' ? 'selected' : ''} onClick={() => onPeriodChange('tomorrow')}>Demain</button><button className={period === 'week' ? 'selected' : ''} onClick={() => onPeriodChange('week')}>Cette semaine</button></div><button onClick={onCreate}>+ Nouveau voyage</button></div><TripTable trips={trips} /><div className="panel info-panel"><strong>Conseil opérationnel</strong><span>Les places vendues au guichet et en ligne sont synchronisées immédiatement pour éviter les doubles réservations.</span></div></>;
}

function Sales({ onSale, onScan }: { onSale: () => void; onScan: () => void }) {
  return <><div className="sales-head"><div className="search"><span>⌕</span><input placeholder="Rechercher par référence ou téléphone..." /><button>Rechercher</button></div><button onClick={onSale}>+ Nouvelle vente</button></div><div className="grid cards"><article className="panel"><h2>Billets du jour</h2><strong className="big-number">284</strong><p>250 ventes en ligne · 34 au guichet</p></article><article className="panel"><h2>Embarquements</h2><strong className="big-number">76</strong><p>Billets contrôlés aujourd’hui</p><button className="outline" onClick={onScan}>Ouvrir le contrôle QR</button></article></div><article className="panel"><div className="panel-title"><div><h2>Dernières ventes</h2><p>Reçus et statuts de paiement</p></div></div><table><thead><tr><th>Référence</th><th>Passager</th><th>Trajet</th><th>Paiement</th><th>Montant</th><th>Statut</th></tr></thead><tbody><tr><td>FT-2026-00481</td><td>Issaka Ouédraogo</td><td>Ouaga → Bobo</td><td>Orange Money</td><td>7 500 F</td><td><b className="badge green">Payé</b></td></tr><tr><td>FT-2026-00480</td><td>Awa Traoré</td><td>Ouaga → Koudougou</td><td>Espèces</td><td>5 000 F</td><td><b className="badge green">Payé</b></td></tr></tbody></table></article></>;
}

function Agencies({ onManage }: { onManage: (name: string) => void }) {
  return <div className="agency-grid">{[['OU', 'Ouagadougou', 'Guichet central', '142 billets', '642 000 F', 'avatar'], ['BO', 'Bobo-Dioulasso', 'Gare routière', '98 billets', '488 000 F', 'avatar orange'], ['KO', 'Koudougou', 'Agence centre-ville', '44 billets', '290 000 F', 'avatar purple']].map(([initials, name, location, sales, revenue, color]) => <article className="panel agency-card" key={name}><span className={color}>{initials}</span><h2>{name}</h2><p>{location}</p><strong>{sales}</strong><b>{revenue}</b><button className="outline" onClick={() => onManage(name)}>Gérer l’agence</button></article>)}</div>;
}

const baggageStatuses = [
  ['REGISTERED', 'Enregistré'],
  ['RECEIVED', 'Reçu à l’agence'],
  ['LOADED', 'Chargé'],
  ['IN_TRANSIT', 'En transit'],
  ['ARRIVED', 'Arrivé'],
  ['DELIVERED', 'Remis au client'],
  ['INCIDENT', 'Incident'],
] as const;

function BaggagePage({ baggage, onRegister, onUpdateStatus }: { baggage: Baggage[]; onRegister: () => void; onUpdateStatus: (trackingCode: string, status: string) => void }) {
  return <><div className="toolbar"><div><strong>{baggage.length} bagage(s) suivi(s)</strong><p className="subheading">Chaque voyageur reçoit un code à communiquer au client.</p></div><button onClick={onRegister}>+ Enregistrer un bagage</button></div>{baggage.length === 0 ? <div className="panel info-panel"><strong>Aucun bagage enregistré</strong><span>Enregistrez un bagage avec la référence du billet pour générer son code de suivi.</span></div> : <article className="panel"><div className="panel-title"><div><h2>Suivi des bagages</h2><p>Dernières mises à jour de votre société</p></div></div><table><thead><tr><th>Code de suivi</th><th>Voyageur</th><th>Trajet</th><th>Bagage</th><th>Statut</th></tr></thead><tbody>{baggage.map((item) => <tr key={item.trackingCode}><td><strong>{item.trackingCode}</strong><br /><small>{item.ticket.reference}</small></td><td>{item.ticket.customer.fullName}<br /><small>{item.ticket.customer.phone}</small></td><td>{item.ticket.trip.route.departureCity} → {item.ticket.trip.route.arrivalCity}</td><td>{item.description}<br /><small>{item.weightKg} kg</small></td><td><select className="status-select" value={item.status} onChange={(event) => onUpdateStatus(item.trackingCode, event.target.value)}>{baggageStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table></article>}</>;
}

function Fleet({ onView }: { onView: (registration: string) => void }) {
  return <div className="agency-grid">{[['BF 3021 AB', 'Autocar climatisé', '50 places', 'En service'], ['BF 1847 AC', 'Autocar standard', '50 places', 'En service'], ['BF 2088 AA', 'Minibus', '30 places', 'Maintenance']].map(([registration, label, seats, status]) => <article className="panel vehicle-card" key={registration}><span className="bus">▱</span><div><h2>{registration}</h2><p>{label} · {seats}</p></div><b className={`badge ${status === 'En service' ? 'green' : 'orange-badge'}`}>{status}</b><button className="outline" onClick={() => onView(registration)}>Voir le véhicule</button></article>)}</div>;
}

function Finance() {
  return <><div className="stats"><Stat label="Encaissements du mois" value="32 480 000" unit="FCFA" trend="+14,2% vs mois dernier" /><Stat label="Frais Siira Transport" value="284 000" unit="FCFA" trend="100 FCFA / billet en ligne" /><Stat label="Ventes espèces" value="8 420 000" unit="FCFA" trend="26% des encaissements" /><Stat label="Remboursements" value="126 000" unit="FCFA" trend="18 billets ce mois" /></div>    <article className="panel"><div className="panel-title"><div><h2>Répartition des paiements</h2><p>Adaptée aux moyens de paiement locaux</p></div></div><div className="payment-row"><span>Orange Money</span><div className="bar large"><i style={{ width: '42%' }} /></div><b>42%</b></div><div className="payment-row"><span>Moov Money</span><div className="bar large"><i style={{ width: '18%' }} /></div><b>18%</b></div><div className="payment-row"><span>Telecel Money</span><div className="bar large"><i style={{ width: '12%' }} /></div><b>12%</b></div><div className="payment-row"><span>Wave</span><div className="bar large"><i style={{ width: '10%' }} /></div><b>10%</b></div><div className="payment-row"><span>Espèces guichet</span><div className="bar large"><i style={{ width: '18%' }} /></div><b>18%</b></div></article></>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="modal"><div className="modal-head"><h2>{title}</h2><button className="close" onClick={close}>×</button></div>{children}</section></div>;
}

createRoot(document.getElementById('root')!).render(<App />);

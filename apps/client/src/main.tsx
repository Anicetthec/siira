import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { pendingCount, queueRequest, syncQueue } from './offline';

type Trip = { id: string; departureAt: string; price: number; route: { departureCity: string; arrivalCity: string }; vehicle: { seatCount: number }; seats: { id: string; number: string }[] };
type Dialog = 'login' | 'register' | 'help' | 'tickets' | 'baggage' | 'reservation' | null;

function App() {
  const [departure, setDeparture] = useState('Ouagadougou');
  const [arrival, setArrival] = useState('Bobo-Dioulasso');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState('');
  const [ticketReference, setTicketReference] = useState('');
  const [baggageTrackingCode, setBaggageTrackingCode] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) void syncQueue().then(({ pending: count }) => setPending(count)); };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  });

  async function submitAccount(event: FormEvent<HTMLFormElement>, mode: 'login' | 'register') {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`https://siira-api.onrender.com/api/auth/client/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: form.get('fullName'), phone: form.get('phone'), password: form.get('password') }),
    });
    const result = await response.json().catch(() => null) as { message?: string; fullName?: string } | null;
    if (!response.ok) {
      setAccountMessage(Array.isArray(result?.message) ? result.message.join(', ') : result?.message ?? 'Connexion impossible');
      return;
    }
    setMessage(mode === 'register' ? 'Compte client créé avec succès.' : `Bienvenue ${result?.fullName ?? ''}.`);
    setAccountMessage('');
    setDialog(null);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`https://siira-api.onrender.com/api/trips?departureCity=${encodeURIComponent(departure.trim())}&arrivalCity=${encodeURIComponent(arrival.trim())}`);
      if (!response.ok) throw new Error('Recherche indisponible');
      setTrips(await response.json());
    } catch {
      setTrips([]);
      setMessage('Le serveur est indisponible. Vérifiez que l’API Siira est démarrée.');
    }
    setSearched(true);
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.seats[0]) {
      setMessage('Aucune place disponible pour ce départ.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const requestId = crypto.randomUUID();
    const body = JSON.stringify({ tripId: selected.id, seatId: selected.seats[0].id, fullName: form.get('fullName'), phone: form.get('phone'), paymentProvider: form.get('paymentProvider'), requestId });
    try {
      if (!online) throw new Error('offline');
      const response = await fetch('https://siira-api.onrender.com/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (!response.ok) throw new Error('Réservation impossible');
      const ticket = await response.json() as { reference: string };
      setMessage(`Réservation confirmée : ${ticket.reference}.`);
      setSelected(null);
      setDialog(null);
    } catch {
      if (!online) {
        queueRequest({ url: 'https://siira-api.onrender.com/api/tickets', method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        setPending(pendingCount());
        setMessage('Réservation enregistrée hors ligne. Elle sera synchronisée dès le retour d’Internet.');
      } else setMessage('Cette place n’est plus disponible ou l’API est indisponible.');
    }

  }

  async function lookupTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`https://siira-api.onrender.com/api/tickets/${encodeURIComponent(ticketReference)}`);
      if (!response.ok) throw new Error('Billet introuvable');
      const ticket = await response.json() as { status: string; trip: { route: { departureCity: string; arrivalCity: string } }; seat: { number: string } };
      setMessage(`Billet ${ticketReference} : ${ticket.status} · ${ticket.trip.route.departureCity} → ${ticket.trip.route.arrivalCity} · place ${ticket.seat.number}.`);
    } catch {
      setMessage(`Le billet ${ticketReference} est introuvable ou l’API est indisponible.`);
    }

    setDialog(null);
  }

  async function lookupBaggage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`https://siira-api.onrender.com/api/baggage/${encodeURIComponent(baggageTrackingCode)}`);
      if (!response.ok) throw new Error('Bagage introuvable');
      const baggage = await response.json() as { status: string; description: string; weightKg: number; ticket: { trip: { route: { departureCity: string; arrivalCity: string } } } };
      const status = { REGISTERED: 'enregistré', RECEIVED: 'reçu à l’agence', LOADED: 'chargé', IN_TRANSIT: 'en transit', ARRIVED: 'arrivé', DELIVERED: 'remis au client', INCIDENT: 'signalé en incident' }[baggage.status] ?? baggage.status;
      setMessage(`Bagage ${baggageTrackingCode} : ${status} · ${baggage.description}, ${baggage.weightKg} kg · ${baggage.ticket.trip.route.departureCity} → ${baggage.ticket.trip.route.arrivalCity}.`);
    } catch {
      setMessage(`Le bagage ${baggageTrackingCode} est introuvable ou l’API est indisponible.`);
    }
    setDialog(null);
  }

  function chooseDestination(from: string, to: string) {
    setDeparture(from);
    setArrival(to);
    setSearched(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <main><nav><button className="brand-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><strong className="logo-lockup"><img src="/siira-logo.svg" alt="Siira" /> <span>Siira</span></strong></button><button className="nav-link" onClick={() => setDialog('tickets')}>Mes billets</button><button className="nav-link" onClick={() => setDialog('baggage')}>Suivre un bagage</button><button className="nav-link" onClick={() => setDialog('help')}>Aide</button><button onClick={() => setDialog('login')}>Se connecter</button></nav><section className="hero"><p className="eyebrow">VOYAGEZ SEREINEMENT AU BURKINA FASO AVEC SIIRA</p><h1>Votre prochain voyage commence ici.</h1><p>Comparez les départs des compagnies et réservez votre place en quelques minutes.</p><form onSubmit={search}><label>Départ<input value={departure} onChange={(event) => setDeparture(event.target.value)} /></label><label>Destination<input value={arrival} onChange={(event) => setArrival(event.target.value)} /></label><label>Date<input type="date" defaultValue="2026-11-07" /></label><button type="submit">Rechercher un voyage</button></form></section><section className="results">{message && <div className="notice">{message}</div>}<div className="section-head"><div><p className="eyebrow">RÉSULTATS CENTRALISÉS SIIRA</p><h2>{searched ? `${trips.length} départ(s) trouvé(s)` : 'Destinations populaires'}</h2></div><span>Prix en FCFA · Orange Money, Moov Money, Telecel Money, Wave ou guichet</span></div>{searched && trips.length === 0 && <div className="empty">Aucun départ disponible pour cette recherche. Essayez une autre ville ou contactez une agence.</div>}{trips.map((trip) => <article className="trip" key={trip.id}><div><strong>{new Date(trip.departureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong><span>{trip.route.departureCity} → {trip.route.arrivalCity}</span></div><span>{trip.vehicle.seatCount} places</span><strong>{new Intl.NumberFormat('fr-FR').format(trip.price)} FCFA</strong><button onClick={() => { setSelected(trip); setDialog('reservation'); }}>Choisir ce départ</button></article>)}{!searched && <div className="destinations"><button onClick={() => chooseDestination('Ouagadougou', 'Bobo-Dioulasso')}>Ouagadougou → Bobo-Dioulasso</button><button onClick={() => chooseDestination('Ouagadougou', 'Koudougou')}>Ouagadougou → Koudougou</button><button onClick={() => chooseDestination('Bobo-Dioulasso', 'Ouagadougou')}>Bobo-Dioulasso → Ouagadougou</button></div>}</section><footer>© Siira · Une plateforme pensée pour les voyageurs et compagnies du Burkina Faso</footer>{dialog === 'reservation' && selected && <Dialog title="Réserver votre place" close={() => setDialog(null)}><form onSubmit={reserve}><p>{selected.route.departureCity} → {selected.route.arrivalCity} · {selected.seats[0] ? `Place ${selected.seats[0].number}` : 'Aucune place disponible'}</p><input name="fullName" placeholder="Nom complet" required /><input name="phone" placeholder="Téléphone (ex. 70 00 00 00)" required /><select name="paymentProvider"><option value="ORANGE_MONEY">Orange Money</option><option value="MOOV_MONEY">Moov Money</option><option value="TELECEL_MONEY">Telecel Money</option><option value="WAVE">Wave</option><option value="CASH">Paiement au guichet</option></select><button type="submit">Confirmer la réservation</button></form></Dialog>  }{dialog === 'login' && <Dialog title="Connexion client" close={() => { setAccountMessage(''); setDialog(null); }}><form onSubmit={(event) => void submitAccount(event, 'login')}><input name="phone" placeholder="Numéro de téléphone" required /><input name="password" type="password" minLength={8} placeholder="Mot de passe" required />{accountMessage && <p className="form-error">{accountMessage}</p>}<button type="submit">Se connecter</button><button type="button" className="secondary-action" onClick={() => { setAccountMessage(''); setDialog('register'); }}>Créer un compte</button></form></Dialog>}{dialog === 'register' && <Dialog title="Créer un compte client" close={() => { setAccountMessage(''); setDialog(null); }}><form onSubmit={(event) => void submitAccount(event, 'register')}><input name="fullName" placeholder="Nom complet" required /><input name="phone" placeholder="Numéro de téléphone" required /><input name="password" type="password" minLength={8} placeholder="Mot de passe (8 caractères minimum)" required />{accountMessage && <p className="form-error">{accountMessage}</p>}<button type="submit">Créer mon compte</button><button type="button" className="secondary-action" onClick={() => { setAccountMessage(''); setDialog('login'); }}>J’ai déjà un compte</button></form></Dialog>}{dialog === 'help' && <Dialog title="Centre d’aide" close={() => setDialog(null)}><p>Besoin d’aide ? Contactez le support Siira au <strong>70 00 00 00</strong>, tous les jours de 7h à 22h.</p><button onClick={() => window.open('tel:+22670000000')}>Appeler le support</button></Dialog>}{dialog === 'tickets' && <Dialog title="Retrouver mes billets" close={() => setDialog(null)}><form onSubmit={lookupTicket}><input value={ticketReference} onChange={(event) => setTicketReference(event.target.value)} placeholder="Référence FT-2026-..." required /><button type="submit">Rechercher mon billet</button></form></Dialog>}{dialog === 'baggage' && <Dialog title="Suivre un bagage" close={() => setDialog(null)}><form onSubmit={lookupBaggage}><p>Entrez le code remis par la société de transport.</p><input value={baggageTrackingCode} onChange={(event) => setBaggageTrackingCode(event.target.value)} placeholder="BAG-2026-..." required /><button type="submit">Voir le statut</button></form></Dialog>}</main>;
}

function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="dialog"><button className="dismiss" onClick={close}>×</button><h2>{title}</h2>{children}</section></div>;
}

createRoot(document.getElementById('root')!).render(<App />);

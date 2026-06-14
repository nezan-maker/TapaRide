import { Link } from 'react-router-dom'
import SearchWidget from '../components/SearchWidget'
import Fa from '../components/Fa';
import ProtectedLink from '../components/ProtectedLink';

// Local images of iconic Rwandan landmarks, sourced from Wikimedia Commons
// under CC BY-SA / CC0. Credits per image:
//   Karongi:  Napoleon Island, Lake Kivu — Adam Jones, CC BY-SA 2.0
//             https://commons.wikimedia.org/wiki/File:Scenery_on_Napoleon_Island_-_Lake_Kivu_-_Near_Kibuye_(Karongi)_-_Rwanda_-_01_(8978755533).jpg
//   Kigali:   Kigali Convention Centre — Igiraneza Divine, CC0 1.0
//             https://commons.wikimedia.org/wiki/File:Kigali_Convention_Centre.jpg
//   Muhanga:  Cathedral Basilica of Our Lady, Kabgayi — Ivan Mucyo, CC BY-SA 4.0
//             (Kabgayi is in Muhanga District; the cathedral is Rwanda's oldest, built 1925.)
//             https://commons.wikimedia.org/wiki/File:The_Catholic_Cathedral_in_Kabgayi.jpg
//   Nyagatare:Akagera National Park giraffes — Alex Shema, CC BY-SA 4.0
//             https://commons.wikimedia.org/wiki/File:Akagera_National_Park_Giraffes.jpg
//   Huye:     National Museum of Rwanda (Butare) — Amakuru, CC BY-SA 3.0
//             https://commons.wikimedia.org/wiki/File:RwandaNationalMuseum.jpg
//   Musanze:  Sabyinyo volcano, Kinigi sector — Maxime Ishmax, CC BY-SA 4.0
//             https://commons.wikimedia.org/wiki/File:Sabyinyo_volcanoe_view_from_Kinigi_sector,_Musanze_district,_Rwanda.jpg
//   Rubavu:   Lake Kivu at Gisenyi — Arafat Abdallah, CC BY-SA 4.0
//             https://commons.wikimedia.org/wiki/File:Lake_Kivu_at_Gisenyi,_Rwanda.jpg
//   Rusizi:   Nyungwe canopy walkway — Dusabinemaclaire, CC BY-SA 4.0
//             https://commons.wikimedia.org/wiki/File:Nyungwe_canopywalk-way_View.jpg
//
// The Kigali card is the centrepiece ("hub") of the hexagon layout below.
type Destination = {
  city: string;
  province: string;
  blurb: string;
  image: string;
  trips: number;
  hub?: boolean;
};

const popularDestinations: Destination[] = [
  // Centrepiece — Kigali, the capital and main hub.
  {
    city: 'Kigali',
    province: 'Capital · Kigali Province',
    blurb:
      'The capital and our main hub. Clean, walkable, and the gateway to every other city on this page.',
    image: '/destinations/kigali-convention-centre.jpg',
    trips: 96,
    hub: true,
  },
  // Outer ring — 6 cities, arranged geographically clockwise from the north.
  {
    city: 'Musanze',
    province: 'Northern Province',
    blurb:
      'Gateway to Volcanoes National Park — home of the mountain gorillas and the Virunga volcanoes.',
    image: '/destinations/musanze-sabyinyo-volcano.jpg',
    trips: 18,
  },
  {
    city: 'Rubavu',
    province: 'Western Province',
    blurb: 'Relax on the shores of Lake Kivu with stunning sunset views over the water.',
    image: '/destinations/rubavu-lake-kivu.jpg',
    trips: 15,
  },
  {
    city: 'Karongi',
    province: 'Western Province',
    blurb:
      'Forested Napoleon Island rises out of Lake Kivu — a true Congo-Nile Trail highlight.',
    image: '/destinations/karongi-napoleon-island.jpg',
    trips: 11,
  },
  {
    city: 'Huye',
    province: 'Southern Province',
    blurb:
      'Explore the National Museum of Rwanda and surrounding cultural heritage sites.',
    image: '/destinations/huye-national-museum.jpg',
    trips: 24,
  },
  {
    city: 'Muhanga',
    province: 'Southern Province',
    blurb:
      'Home to the Cathedral Basilica of Our Lady in Kabgayi — Rwanda\'s oldest cathedral and a center of Catholic heritage since 1925.',
    image: '/destinations/muhanga-kabgayi-cathedral.jpg',
    trips: 9,
  },
  {
    city: 'Nyagatare',
    province: 'Eastern Province',
    blurb:
      'Gateway to Akagera National Park — savanna wildlife including giraffes, zebras, and lions.',
    image: '/destinations/nyagatare-akagera-giraffes.jpg',
    trips: 7,
  },
  {
    city: 'Rusizi',
    province: 'Western Province',
    blurb:
      'Gateway to Nyungwe National Park and its famous rainforest canopy walkway.',
    image: '/destinations/rusizi-nyungwe-canopy.jpg',
    trips: 12,
  },
];

const hub = popularDestinations.find((d) => d.hub)!;
const ring = popularDestinations.filter((d) => !d.hub);

const services = [
  {
    icon: 'bus',
    title: 'Book a Bus',
    blurb:
      'Travel comfortably across Rwanda with our network of premium buses. Real-time availability, secure payments, and digital tickets.',
    cta: 'Find Routes',
    to: '/search',
    // Public route — anyone can browse and compare trips. The actual booking
    // step (on /booking) is gated by router-level <ProtectedRoute>.
    protected: false,
    image:
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=70',
  },
  {
    icon: 'package',
    title: 'Send a Parcel',
    blurb:
      'Fast, reliable, and trackable parcel delivery between major cities. From small envelopes to large cargo, we handle it with care.',
    cta: 'Get a Quote',
    to: '/send-parcel',
    // Sending a parcel requires an account (sender/recipient identity, payment).
    protected: true,
    image:
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=900&q=70',
  },
]

type Step = {
  icon: string;
  step: string;       // small label, e.g. "Step 01"
  title: string;
  blurb: string;
  learnMore: string;  // CTA link target
};

const steps: Step[] = [
  {
    icon: 'magnifying-glass',
    step: 'Step 01',
    title: 'Find your route',
    blurb:
      'Search buses by city pair, departure time, or carrier. Compare fares and seat layouts side by side.',
    learnMore: '/search',
  },
  {
    icon: 'lock',
    step: 'Step 02',
    title: 'Book and pay securely',
    blurb:
      'Pick your seat, pay with Mobile Money or card, and receive a digital ticket — protected end to end.',
    learnMore: '/search',
  },
  {
    icon: 'route',
    step: 'Step 03',
    title: 'Travel or track',
    blurb:
      'Board with a QR ticket or watch your parcel travel in real time from pickup to drop-off.',
    learnMore: '/track',
  },
];

const stats = [
  { value: '120K+', label: 'Trips booked' },
  { value: '15+', label: 'Cities connected' },
  { value: '8', label: 'Partner carriers' },
  { value: '4.8★', label: 'Average rating' },
]

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-mist via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-ink-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-flame-100/50 blur-3xl" />
        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="chip bg-ink-50 text-ink-700">
              <span className="h-1.5 w-1.5 rounded-full bg-flame-600" /> Now live across Rwanda
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Travel smart. <br />
              <span className="text-flame-600">Deliver fast.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg">
              Book premium bus tickets or send parcels securely across Rwanda. The
              easiest way to move you and your goods.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/search" className="btn-primary px-6 py-3.5 text-base">
                Get Started <Fa name="arrow-right" className="h-4 w-4" />
              </Link>
              <a href="#download" className="btn-outline px-6 py-3.5 text-base">
                <Fa name="smartphone" className="h-4 w-4" /> Download App
              </a>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-4 gap-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-xl font-extrabold text-ink-900">{s.value}</div>
                  <div className="text-xs text-ink-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up lg:pl-6">
            <SearchWidget />
          </div>
        </div>
      </section>

      {/* Core services */}
      <section className="container-page py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">What we do</span>
          <h2 className="mt-2 text-3xl font-extrabold text-ink-900 sm:text-4xl">
            Our Core Services
          </h2>
          <p className="mt-3 text-ink-500">
            Seamless logistics solutions tailored for your inter-city travel and
            delivery needs.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {services.map((s) => (
            <div key={s.title} className="card group overflow-hidden">
              <div className="relative h-52 overflow-hidden">
                <img
                  src={s.image}
                  alt={s.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/40 to-transparent" />
                <span className="absolute bottom-4 left-4 grid h-11 w-11 place-items-center rounded-xl bg-white text-ink-900 shadow-soft">
                  <Fa name={s.icon} className="h-5 w-5" />
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-ink-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.blurb}</p>
                {s.protected ? (
                  <>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-400">
                      <Fa name="lock" className="h-3 w-3" />
                      Login required
                    </p>
                    <ProtectedLink
                      to={s.to}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-flame-600 transition hover:gap-2.5"
                    >
                      {s.cta} <Fa name="arrow-right" className="h-4 w-4" />
                    </ProtectedLink>
                  </>
                ) : (
                  <Link
                    to={s.to}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-flame-600 transition hover:gap-2.5"
                  >
                    {s.cta} <Fa name="arrow-right" className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular destinations */}
      <section className="bg-mist py-16 lg:py-24">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Explore</span>
              <h2 className="mt-2 text-3xl font-extrabold text-ink-900 sm:text-4xl">
                Popular Destinations
              </h2>
              <p className="mt-2 text-ink-500">
                Explore Rwanda's most frequently traveled routes.
              </p>
            </div>
            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:gap-2.5"
            >
              View all routes <Fa name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>

          {/* Hexagon-style cluster: 7 cities orbiting Kigali. On `lg` the Kigali
              card spans the full middle row to read as a clear "hub", with three
              cities on each side (top, middle-row flanks, bottom). On `md` the
              layout collapses to a 2-col grid, on `sm` a single column. */}
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
            {/* Top row — 2 outer cities */}
            <DestinationCard d={ring[0]} className="lg:col-start-1 lg:row-start-1" />
            <DestinationCard d={ring[1]} className="lg:col-start-3 lg:row-start-1" />

            {/* Middle row — Kigali hub + 2 outer cities */}
            <DestinationCard
              d={hub}
              variant="hub"
              className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-full"
            />
            <DestinationCard d={ring[2]} className="lg:col-start-1 lg:row-start-2" />
            <DestinationCard d={ring[3]} className="lg:col-start-3 lg:row-start-2" />

            {/* Bottom row — 2 outer cities */}
            <DestinationCard d={ring[4]} className="lg:col-start-1 lg:row-start-3" />
            <DestinationCard d={ring[5]} className="lg:col-start-3 lg:row-start-3" />
            <DestinationCard
              d={ring[6]}
              className="md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-3"
            />
          </div>
        </div>
      </section>

      {/* How it works — Apple-inspired editorial cards. Soft gray band, three
          white cards with generous whitespace, large outline icons, small
          "Step 0X" eyebrow, display-size headline, and an inline "Learn more"
          link. No numbered badges, no connecting line — the design breathes. */}
      <section className="bg-haze py-20 lg:py-32">
        <div className="container-page">
          <div className="max-w-3xl">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Three steps.<br />
              <span className="text-ink-400">One smooth trip.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-500">
              From the first search to the moment you reach your destination —
              every step is designed to feel effortless.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <article
                key={s.title}
                className="group relative flex h-full flex-col rounded-3xl border border-ink-100/80 bg-white p-8 shadow-soft transition hover:shadow-card lg:p-10"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-600">
                    {s.step}
                  </span>
                  <Fa
                    name={s.icon}
                    className="h-10 w-10 text-ink-900 transition group-hover:text-flame-600"
                  />
                </div>

                <h3 className="mt-12 text-2xl font-semibold tracking-tight text-ink-900 lg:text-3xl">
                  {s.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-ink-500">
                  {s.blurb}
                </p>

                <div className="mt-auto pt-8">
                  <ProtectedLink
                    to={s.learnMore}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-flame-600 transition hover:gap-2.5"
                  >
                    Learn more <Fa name="arrow-right" className="h-3.5 w-3.5" />
                  </ProtectedLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / download */}
      <section id="download" className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-8 py-14 text-white shadow-glow sm:px-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-flame-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-1 text-flame-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Fa name="star" key={i} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-2 text-sm text-white/70">Loved by 50,000+ travelers</span>
              </div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">
                Get the TapaRide app
              </h2>
              <p className="mt-3 max-w-md text-white/70">
                Book faster, track parcels live, and never miss a trip. Available on iOS
                and Android.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#" className="btn bg-white text-ink-900 hover:bg-white/90">
                  App Store
                </a>
                <a href="#" className="btn border border-white/25 text-white hover:bg-white/10">
                  Google Play
                </a>
              </div>
            </div>
            <div className="hidden justify-end lg:flex">
              <div className="w-64 rounded-3xl border border-white/15 bg-white/5 p-5 backdrop-blur">
                <SearchPreview />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SearchPreview() {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-xl bg-white/10 p-3">
        <div className="text-[10px] uppercase tracking-wide text-white/50">Next trip</div>
        <div className="mt-1 font-semibold">Kigali → Huye</div>
        <div className="text-xs text-white/60">Tue, 15 Jul · 08:00 AM · Seat A2</div>
      </div>
      <div className="rounded-xl bg-white/10 p-3">
        <div className="text-[10px] uppercase tracking-wide text-white/50">Parcel</div>
        <div className="mt-1 font-semibold">TR-9K2L-88X</div>
        <div className="text-xs text-flame-500">In transit · Huye</div>
      </div>
      <div className="rounded-xl bg-flame-600 p-3 text-center font-semibold">
        Open TapaRide
      </div>
    </div>
  )
}

/**
 * A single destination card. Renders two variants:
 *   - "default" — standard height, used for the 7 outer cities.
 *   - "hub"     — visually heavier (taller, larger headline, "HUB" badge, accent
 *                 ring), used only for the Kigali card.
 */
function DestinationCard({
  d,
  variant = 'default',
  className = '',
}: {
  d: Destination;
  variant?: 'default' | 'hub';
  className?: string;
}) {
  const isHub = variant === 'hub';
  return (
    <Link
      to="/search"
      key={d.city}
      className={
        'group relative overflow-hidden rounded-2xl shadow-card transition hover:shadow-glow ' +
        (isHub ? 'h-96 lg:h-full' : 'h-72') +
        ' ' +
        className
      }
    >
      <img
        src={d.image}
        alt={d.city}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
      {isHub && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-flame-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Main Hub
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <span className="chip bg-white/15 text-white backdrop-blur">
          {d.province}
        </span>
        <h3 className={'mt-2 font-bold ' + (isHub ? 'text-3xl' : 'text-xl')}>
          {d.city}
        </h3>
        <p className={'mt-1 text-white/80 ' + (isHub ? 'text-sm' : 'text-sm')}>
          {d.blurb}
        </p>
        {isHub && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-flame-500">
            <Fa name="arrow-right" className="h-3.5 w-3.5" />
            Explore {d.trips} weekly trips
          </span>
        )}
      </div>
    </Link>
  );
}

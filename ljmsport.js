// ════════════════════════════════════════════════════════
//  LJMSPORT SHOP  — Supabase Edition
//  Requires: ljmsport-supabase.js loaded first in HTML
// ════════════════════════════════════════════════════════

// ── LOCAL-ONLY KEYS (cart/wishlist/session stay in localStorage — no cross-device need) ──
const LS_CART     = 'ljmCart';
const LS_WISHLIST = 'ljmWishlist';
const LS_USER     = 'ljmUser';

// ── Verification state ──
let _pendingRegData = null;

// ════════════════════════════════════════════════════════
//  MISAMIS OCCIDENTAL — Full Address Database
//  Structure: { municipality: { zip, barangays: { name: [puroks] } } }
// ════════════════════════════════════════════════════════
const MIS_OCC = {
  "Oroquieta City": {
    zip: "7207",
    barangays: {
      "Poblacion 1": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Poblacion 2": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Poblacion 3": ["Purok 1","Purok 2","Purok 3"],
      "Baybay": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Betonan": ["Purok 1","Purok 2","Purok 3"],
      "Buracan": ["Purok 1","Purok 2","Purok 3"],
      "Canubigan": ["Purok 1","Purok 2"],
      "Capucao C": ["Purok 1","Purok 2","Purok 3"],
      "Capucao P": ["Purok 1","Purok 2","Purok 3"],
      "Carefully": ["Purok 1","Purok 2"],
      "Ciriaco": ["Purok 1","Purok 2","Purok 3"],
      "Dolipos Alto": ["Purok 1","Purok 2","Purok 3"],
      "Dolipos Bajo": ["Purok 1","Purok 2"],
      "Dulapo": ["Purok 1","Purok 2"],
      "Lamac": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Layawan": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Loboc": ["Purok 1","Purok 2","Purok 3"],
      "Lumbayao": ["Purok 1","Purok 2","Purok 3"],
      "Mabini": ["Purok 1","Purok 2","Purok 3"],
      "Malindang": ["Purok 1","Purok 2"],
      "Mialen": ["Purok 1","Purok 2","Purok 3"],
      "Mobod": ["Purok 1","Purok 2","Purok 3"],
      "Paypay": ["Purok 1","Purok 2"],
      "Pines": ["Purok 1","Purok 2","Purok 3"],
      "San Vicente Alto": ["Purok 1","Purok 2","Purok 3"],
      "San Vicente Bajo": ["Purok 1","Purok 2","Purok 3"],
      "Sinacaban": ["Purok 1","Purok 2"],
      "Sumirap": ["Purok 1","Purok 2","Purok 3"],
      "Tabon": ["Purok 1","Purok 2"],
      "Tipan": ["Purok 1","Purok 2","Purok 3"],
      "Toliyok": ["Purok 1","Purok 2"],
      "Tuyabao": ["Purok 1","Purok 2"],
    }
  },
  "Ozamiz City": {
    zip: "7200",
    barangays: {
      "Baybay San Roque": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Baybay Santa Cruz": ["Purok 1","Purok 2","Purok 3"],
      "Baybay Triunfo": ["Purok 1","Purok 2"],
      "Calabayan": ["Purok 1","Purok 2","Purok 3"],
      "Carangan": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Catadman-Manabay": ["Purok 1","Purok 2","Purok 3"],
      "Cogon": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Diguan": ["Purok 1","Purok 2"],
      "Dimaluna": ["Purok 1","Purok 2","Purok 3"],
      "Dolipos": ["Purok 1","Purok 2"],
      "Dullan Norte": ["Purok 1","Purok 2","Purok 3"],
      "Dullan Sur": ["Purok 1","Purok 2","Purok 3"],
      "Gango": ["Purok 1","Purok 2"],
      "Labinay": ["Purok 1","Purok 2","Purok 3"],
      "Lam-an": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5","Purok 6"],
      "Liposong": ["Purok 1","Purok 2","Purok 3"],
      "Litapan": ["Purok 1","Purok 2"],
      "Malaubang": ["Purok 1","Purok 2","Purok 3"],
      "Manara": ["Purok 1","Purok 2"],
      "Marcos": ["Purok 1","Purok 2","Purok 3"],
      "Molicay": ["Purok 1","Purok 2","Purok 3"],
      "Nanaon": ["Purok 1","Purok 2","Purok 3"],
      "Pines Norte": ["Purok 1","Purok 2","Purok 3"],
      "Poblacion I": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Poblacion II": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Poblacion III": ["Purok 1","Purok 2","Purok 3"],
      "Sangay": ["Purok 1","Purok 2","Purok 3"],
      "Sinunok": ["Purok 1","Purok 2","Purok 3"],
      "Tabid": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Tinago": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Triunfo": ["Purok 1","Purok 2","Purok 3"],
      "Aside": ["Purok 1","Purok 2","Purok 3"],
      "Bagakay": ["Purok 1","Purok 2"],
      "Balintad": ["Purok 1","Purok 2","Purok 3"],
      "Camanga": ["Purok 1","Purok 2"],
      "Cantu-od": ["Purok 1","Purok 2","Purok 3"],
      "Dao": ["Purok 1","Purok 2"],
      "Guimad": ["Purok 1","Purok 2","Purok 3"],
      "Kinuman Norte": ["Purok 1","Purok 2"],
      "Kinuman Sur": ["Purok 1","Purok 2","Purok 3"],
      "Labuyo": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Labo": ["Purok 1","Purok 2"],
      "Lawa-an": ["Purok 1","Purok 2","Purok 3"],
      "Loboc": ["Purok 1","Purok 2"],
      "Mialen": ["Purok 1","Purok 2","Purok 3"],
      "Pantaon": ["Purok 1","Purok 2"],
      "Punta Gorda": ["Purok 1","Purok 2","Purok 3"],
      "Rizal": ["Purok 1","Purok 2"],
      "Solano": ["Purok 1","Purok 2","Purok 3"],
      "Taluban": ["Purok 1","Purok 2"],
      "Tignapoloan": ["Purok 1","Purok 2","Purok 3"],
    }
  },
  "Tangub City": {
    zip: "7214",
    barangays: {
      "Aquino": ["Purok 1","Purok 2","Purok 3"],
      "Banglay": ["Purok 1","Purok 2"],
      "Baybay Dacu": ["Purok 1","Purok 2","Purok 3"],
      "Baybay Rizal": ["Purok 1","Purok 2","Purok 3"],
      "Bintana": ["Purok 1","Purok 2"],
      "Bocator": ["Purok 1","Purok 2","Purok 3"],
      "Bolibol": ["Purok 1","Purok 2"],
      "Buenavista": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Butuan": ["Purok 1","Purok 2","Purok 3"],
      "Capalaran": ["Purok 1","Purok 2"],
      "Catagan": ["Purok 1","Purok 2","Purok 3"],
      "Cavinte": ["Purok 1","Purok 2"],
      "Compol": ["Purok 1","Purok 2","Purok 3"],
      "Dalpe": ["Purok 1","Purok 2"],
      "Gabu": ["Purok 1","Purok 2","Purok 3"],
      "Gata Daku": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Gata Diot": ["Purok 1","Purok 2"],
      "Gatas": ["Purok 1","Purok 2","Purok 3"],
      "Isidto": ["Purok 1","Purok 2"],
      "Luy-a": ["Purok 1","Purok 2","Purok 3"],
      "Maloro": ["Purok 1","Purok 2","Purok 3"],
      "Mantic": ["Purok 1","Purok 2","Purok 3"],
      "Maquilao": ["Purok 1","Purok 2"],
      "Minsubong": ["Purok 1","Purok 2","Purok 3"],
      "Owayan": ["Purok 1","Purok 2"],
      "Panalsalan": ["Purok 1","Purok 2","Purok 3"],
      "Pangaranon": ["Purok 1","Purok 2"],
      "Pangasaan": ["Purok 1","Purok 2","Purok 3"],
      "Pitubo": ["Purok 1","Purok 2"],
      "Poblacion Norte": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5","Purok 6"],
      "Poblacion Sur": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Sas": ["Purok 1","Purok 2","Purok 3"],
      "Silanga": ["Purok 1","Purok 2"],
      "Siloy": ["Purok 1","Purok 2","Purok 3"],
      "Sugbongcogon": ["Purok 1","Purok 2","Purok 3"],
      "Sumirap": ["Purok 1","Purok 2"],
      "Talabaan": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Tibo": ["Purok 1","Purok 2","Purok 3"],
      "Tipolo": ["Purok 1","Purok 2"],
      "Waterfall": ["Purok 1","Purok 2","Purok 3"],
    }
  },
  "Aloran": {
    zip: "7203",
    barangays: {
      "Balidbid": ["Purok 1","Purok 2","Purok 3"],
      "Balubal": ["Purok 1","Purok 2"],
      "Calaran": ["Purok 1","Purok 2","Purok 3"],
      "Dalid": ["Purok 1","Purok 2"],
      "Don Andres Soriano": ["Purok 1","Purok 2","Purok 3"],
      "Durias": ["Purok 1","Purok 2","Purok 3"],
      "Families": ["Purok 1","Purok 2"],
      "Gata": ["Purok 1","Purok 2","Purok 3"],
      "Labo": ["Purok 1","Purok 2","Purok 3"],
      "Lamac": ["Purok 1","Purok 2"],
      "Lumban": ["Purok 1","Purok 2","Purok 3"],
      "Mabuhay": ["Purok 1","Purok 2"],
      "Mamawi": ["Purok 1","Purok 2","Purok 3"],
      "Mantic": ["Purok 1","Purok 2"],
      "Matipul": ["Purok 1","Purok 2","Purok 3"],
      "Mohon": ["Purok 1","Purok 2"],
      "Nailon": ["Purok 1","Purok 2","Purok 3"],
      "Patia": ["Purok 1","Purok 2","Purok 3"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Proper": ["Purok 1","Purok 2"],
      "San Antonio": ["Purok 1","Purok 2","Purok 3"],
      "Sibucao": ["Purok 1","Purok 2"],
      "Silanga": ["Purok 1","Purok 2","Purok 3"],
      "Sinaguing": ["Purok 1","Purok 2"],
      "Siocon": ["Purok 1","Purok 2","Purok 3"],
      "Tamblot": ["Purok 1","Purok 2"],
      "Taugan": ["Purok 1","Purok 2","Purok 3"],
      "Tigue": ["Purok 1","Purok 2"],
      "Tipan": ["Purok 1","Purok 2","Purok 3"],
      "Tubod": ["Purok 1","Purok 2"],
      "Tulang": ["Purok 1","Purok 2","Purok 3"],
      "Villaflor": ["Purok 1","Purok 2"],
    }
  },
  "Baliangao": {
    zip: "7205",
    barangays: {
      "Bagolatao": ["Purok 1","Purok 2","Purok 3"],
      "Baybay": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Clarin Settlement": ["Purok 1","Purok 2"],
      "Del Pilar": ["Purok 1","Purok 2","Purok 3"],
      "Improgo Village": ["Purok 1","Purok 2"],
      "Kimat": ["Purok 1","Purok 2"],
      "Liboron": ["Purok 1","Purok 2","Purok 3"],
      "Lower Salug Daku": ["Purok 1","Purok 2"],
      "Luna": ["Purok 1","Purok 2","Purok 3"],
      "Punta Miray": ["Purok 1","Purok 2"],
      "Punta Sulong": ["Purok 1","Purok 2","Purok 3"],
      "Salug Daku": ["Purok 1","Purok 2","Purok 3"],
      "Salug Diot": ["Purok 1","Purok 2"],
      "Seti": ["Purok 1","Purok 2","Purok 3"],
      "Silanga": ["Purok 1","Purok 2"],
      "Tuburan": ["Purok 1","Purok 2","Purok 3"],
      "Villanueva": ["Purok 1","Purok 2"],
    }
  },
  "Calamba": {
    zip: "7209",
    barangays: {
      "Balatacan": ["Purok 1","Purok 2","Purok 3"],
      "Balite": ["Purok 1","Purok 2"],
      "Binuangan": ["Purok 1","Purok 2","Purok 3"],
      "Bongabong": ["Purok 1","Purok 2"],
      "Dasan": ["Purok 1","Purok 2","Purok 3"],
      "Dayhagan": ["Purok 1","Purok 2"],
      "Del Pilar": ["Purok 1","Purok 2","Purok 3"],
      "Diguan": ["Purok 1","Purok 2"],
      "Dullan": ["Purok 1","Purok 2","Purok 3"],
      "Lamac": ["Purok 1","Purok 2"],
      "Lapasan": ["Purok 1","Purok 2","Purok 3"],
      "Lapu-lapu": ["Purok 1","Purok 2"],
      "Malibas": ["Purok 1","Purok 2","Purok 3"],
      "Managok": ["Purok 1","Purok 2"],
      "Molicay": ["Purok 1","Purok 2","Purok 3"],
      "Pantaon": ["Purok 1","Purok 2"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Sagay": ["Purok 1","Purok 2","Purok 3"],
      "Sibucao": ["Purok 1","Purok 2"],
      "Silanga": ["Purok 1","Purok 2","Purok 3"],
      "Taboc": ["Purok 1","Purok 2"],
      "Tiaman": ["Purok 1","Purok 2","Purok 3"],
    }
  },
  "Clarin": {
    zip: "7204",
    barangays: {
      "Barra": ["Purok 1","Purok 2","Purok 3"],
      "Basirang": ["Purok 1","Purok 2"],
      "Bato": ["Purok 1","Purok 2","Purok 3"],
      "Bogtong Bato": ["Purok 1","Purok 2"],
      "Cahayagan": ["Purok 1","Purok 2","Purok 3"],
      "Caridad": ["Purok 1","Purok 2"],
      "Ciriaco": ["Purok 1","Purok 2","Purok 3"],
      "Demetrio Fernan": ["Purok 1","Purok 2"],
      "Gata": ["Purok 1","Purok 2","Purok 3"],
      "Katipunan": ["Purok 1","Purok 2"],
      "Kinit-an": ["Purok 1","Purok 2","Purok 3"],
      "Labo": ["Purok 1","Purok 2"],
      "Lamaca": ["Purok 1","Purok 2","Purok 3"],
      "Liangan": ["Purok 1","Purok 2"],
      "Lico": ["Purok 1","Purok 2","Purok 3"],
      "Lopoc": ["Purok 1","Purok 2"],
      "Lumban": ["Purok 1","Purok 2","Purok 3"],
      "Mauswagon": ["Purok 1","Purok 2"],
      "Mialen": ["Purok 1","Purok 2","Purok 3"],
      "Mohon": ["Purok 1","Purok 2"],
      "Pato-o": ["Purok 1","Purok 2","Purok 3"],
      "Poblacion Norte": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Poblacion Sur": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Pulot": ["Purok 1","Purok 2"],
      "San Juan": ["Purok 1","Purok 2","Purok 3"],
      "Saulog": ["Purok 1","Purok 2"],
      "Sinobong": ["Purok 1","Purok 2","Purok 3"],
      "Sitio Bagong Sabang": ["Sitio 1","Sitio 2"],
      "Tabok": ["Purok 1","Purok 2","Purok 3"],
      "Talaban": ["Purok 1","Purok 2"],
      "Tamblot": ["Purok 1","Purok 2","Purok 3"],
      "Tilang": ["Purok 1","Purok 2"],
      "Tinago": ["Purok 1","Purok 2","Purok 3"],
    }
  },
  "Concepcion": {
    zip: "7208",
    barangays: {
      "Badiang": ["Purok 1","Purok 2","Purok 3"],
      "Baybay": ["Purok 1","Purok 2"],
      "Camipot": ["Purok 1","Purok 2","Purok 3"],
      "Canangca-an": ["Purok 1","Purok 2"],
      "Ciriaco": ["Purok 1","Purok 2","Purok 3"],
      "Corpuz": ["Purok 1","Purok 2"],
      "Dagupan": ["Purok 1","Purok 2","Purok 3"],
      "Don Bernardo Neri": ["Purok 1","Purok 2"],
      "Garang": ["Purok 1","Purok 2","Purok 3"],
      "Guimad": ["Purok 1","Purok 2"],
      "Gutapol": ["Purok 1","Purok 2","Purok 3"],
      "Ipil": ["Purok 1","Purok 2"],
      "Katipunan": ["Purok 1","Purok 2","Purok 3"],
      "Lamac": ["Purok 1","Purok 2"],
      "Linay": ["Purok 1","Purok 2","Purok 3"],
      "Lupagan": ["Purok 1","Purok 2"],
      "Mohon": ["Purok 1","Purok 2","Purok 3"],
      "Pagawan": ["Purok 1","Purok 2"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Proper": ["Purok 1","Purok 2"],
      "Sinampongan": ["Purok 1","Purok 2","Purok 3"],
      "Tinago": ["Purok 1","Purok 2"],
    }
  },
  "Don Victoriano Chiongbian": {
    zip: "7212",
    barangays: {
      "Anonang": ["Purok 1","Purok 2","Purok 3"],
      "Bagumbayan": ["Purok 1","Purok 2"],
      "Baybay": ["Purok 1","Purok 2","Purok 3"],
      "Dalisay": ["Purok 1","Purok 2"],
      "Fatima": ["Purok 1","Purok 2","Purok 3"],
      "Guinabot": ["Purok 1","Purok 2"],
      "Guipadlog": ["Purok 1","Purok 2","Purok 3"],
      "Gulimbangan": ["Purok 1","Purok 2"],
      "Labiranan": ["Purok 1","Purok 2","Purok 3"],
      "Lantad": ["Purok 1","Purok 2"],
      "Linabuan Norte": ["Purok 1","Purok 2","Purok 3"],
      "Linabuan Sur": ["Purok 1","Purok 2"],
      "Mohon": ["Purok 1","Purok 2","Purok 3"],
      "Pag-asa": ["Purok 1","Purok 2"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Proper": ["Purok 1","Purok 2"],
      "Sagay": ["Purok 1","Purok 2","Purok 3"],
      "Sebucal": ["Purok 1","Purok 2"],
    }
  },
  "Jimenez": {
    zip: "7202",
    barangays: {
      "Acewang": ["Purok 1","Purok 2","Purok 3"],
      "Antipolo": ["Purok 1","Purok 2"],
      "Aurora": ["Purok 1","Purok 2","Purok 3"],
      "Balintad": ["Purok 1","Purok 2"],
      "Buenavista": ["Purok 1","Purok 2","Purok 3"],
      "Dicabo": ["Purok 1","Purok 2"],
      "Dolipos": ["Purok 1","Purok 2","Purok 3"],
      "Gango": ["Purok 1","Purok 2"],
      "Guinabot": ["Purok 1","Purok 2","Purok 3"],
      "Kipit": ["Purok 1","Purok 2"],
      "Lapaz": ["Purok 1","Purok 2","Purok 3"],
      "Libertad": ["Purok 1","Purok 2"],
      "Linao": ["Purok 1","Purok 2","Purok 3"],
      "Mabugnao": ["Purok 1","Purok 2"],
      "Macabug": ["Purok 1","Purok 2","Purok 3"],
      "Magallon Cadena": ["Purok 1","Purok 2"],
      "Matugas Alto": ["Purok 1","Purok 2","Purok 3"],
      "Matugas Bajo": ["Purok 1","Purok 2"],
      "Miligan": ["Purok 1","Purok 2","Purok 3"],
      "Molete": ["Purok 1","Purok 2"],
      "Naga": ["Purok 1","Purok 2","Purok 3"],
      "Pisa-an": ["Purok 1","Purok 2"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Salong": ["Purok 1","Purok 2"],
      "San Antonio": ["Purok 1","Purok 2","Purok 3"],
      "San Isidro": ["Purok 1","Purok 2"],
      "Sawa": ["Purok 1","Purok 2","Purok 3"],
      "Sibaroc": ["Purok 1","Purok 2"],
      "Sinkil": ["Purok 1","Purok 2","Purok 3"],
      "Sinuza": ["Purok 1","Purok 2"],
      "Tipan": ["Purok 1","Purok 2","Purok 3"],
      "Tipolohon": ["Purok 1","Purok 2"],
      "Tudela": ["Purok 1","Purok 2","Purok 3"],
    }
  },
  "Lopez Jaena": {
    zip: "7206",
    barangays: {
      "Bagong Silang": ["Purok 1","Purok 2","Purok 3"],
      "Bala": ["Purok 1","Purok 2"],
      "Baybay": ["Purok 1","Purok 2","Purok 3"],
      "Binuhat": ["Purok 1","Purok 2"],
      "Buda": ["Purok 1","Purok 2","Purok 3"],
      "Caluan": ["Purok 1","Purok 2"],
      "Campo": ["Purok 1","Purok 2","Purok 3"],
      "Canubigan": ["Purok 1","Purok 2"],
      "Caridad": ["Purok 1","Purok 2","Purok 3"],
      "Danao": ["Purok 1","Purok 2"],
      "Gala": ["Purok 1","Purok 2","Purok 3"],
      "Gata": ["Purok 1","Purok 2"],
      "Guinabot": ["Purok 1","Purok 2","Purok 3"],
      "Lahonon": ["Purok 1","Purok 2"],
      "Lawa-an": ["Purok 1","Purok 2","Purok 3"],
      "Lugo": ["Purok 1","Purok 2"],
      "Magkalape": ["Purok 1","Purok 2","Purok 3"],
      "Mait Norte": ["Purok 1","Purok 2"],
      "Mait Sur": ["Purok 1","Purok 2","Purok 3"],
      "Mobod": ["Purok 1","Purok 2"],
      "Mohon": ["Purok 1","Purok 2","Purok 3"],
      "Montol": ["Purok 1","Purok 2"],
      "Pag-asa": ["Purok 1","Purok 2","Purok 3"],
      "Pag-osa": ["Purok 1","Purok 2"],
      "Panalsalan": ["Purok 1","Purok 2","Purok 3"],
      "Parang": ["Purok 1","Purok 2"],
      "Poblacion Norte": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Poblacion Sur": ["Purok 1","Purok 2","Purok 3","Purok 4"],
      "Punta": ["Purok 1","Purok 2","Purok 3"],
      "Rambon": ["Purok 1","Purok 2"],
      "Rizal": ["Purok 1","Purok 2","Purok 3"],
      "Sagay": ["Purok 1","Purok 2"],
      "San Isidro": ["Purok 1","Purok 2","Purok 3"],
      "San Juan": ["Purok 1","Purok 2"],
      "Segatic Daku": ["Purok 1","Purok 2","Purok 3"],
      "Segatic Diot": ["Purok 1","Purok 2"],
      "Silanga": ["Purok 1","Purok 2","Purok 3"],
      "Sunset": ["Purok 1","Purok 2"],
      "Tamin": ["Purok 1","Purok 2","Purok 3"],
      "Tigbao": ["Purok 1","Purok 2"],
    }
  },
  "Panaon": {
    zip: "7213",
    barangays: {
      "Alipao": ["Purok 1","Purok 2","Purok 3"],
      "Baybay": ["Purok 1","Purok 2"],
      "Bogo": ["Purok 1","Purok 2","Purok 3"],
      "Busawi": ["Purok 1","Purok 2"],
      "Caniangan": ["Purok 1","Purok 2","Purok 3"],
      "Cayantog": ["Purok 1","Purok 2"],
      "Gata": ["Purok 1","Purok 2","Purok 3"],
      "Ginicudan": ["Purok 1","Purok 2"],
      "Kagawasan": ["Purok 1","Purok 2","Purok 3"],
      "Libertad": ["Purok 1","Purok 2"],
      "Mabini": ["Purok 1","Purok 2","Purok 3"],
      "Marcelo": ["Purok 1","Purok 2"],
      "Mohon": ["Purok 1","Purok 2","Purok 3"],
      "Naga": ["Purok 1","Purok 2"],
      "Pagawan": ["Purok 1","Purok 2","Purok 3"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Punta": ["Purok 1","Purok 2","Purok 3"],
      "Sibucao": ["Purok 1","Purok 2"],
      "Sinara Daku": ["Purok 1","Purok 2","Purok 3"],
      "Sinara Diot": ["Purok 1","Purok 2"],
    }
  },
  "Plaridel": {
    zip: "7210",
    barangays: {
      "Antipolo": ["Purok 1","Purok 2","Purok 3"],
      "Bacuyangan": ["Purok 1","Purok 2"],
      "Balidbid": ["Purok 1","Purok 2","Purok 3"],
      "Banbanan": ["Purok 1","Purok 2"],
      "Baybay": ["Purok 1","Purok 2","Purok 3"],
      "Bongabong": ["Purok 1","Purok 2"],
      "Buenavista": ["Purok 1","Purok 2","Purok 3"],
      "Calabayan": ["Purok 1","Purok 2"],
      "Dalisay": ["Purok 1","Purok 2","Purok 3"],
      "Datagan": ["Purok 1","Purok 2"],
      "Dicoloc": ["Purok 1","Purok 2","Purok 3"],
      "Dumarait": ["Purok 1","Purok 2"],
      "Durias": ["Purok 1","Purok 2","Purok 3"],
      "Guimad": ["Purok 1","Purok 2"],
      "Lanao": ["Purok 1","Purok 2","Purok 3"],
      "Layawan": ["Purok 1","Purok 2"],
      "Libertad": ["Purok 1","Purok 2","Purok 3"],
      "Limbo": ["Purok 1","Purok 2"],
      "Lingatongan": ["Purok 1","Purok 2","Purok 3"],
      "Lumbayao": ["Purok 1","Purok 2"],
      "Mabini": ["Purok 1","Purok 2","Purok 3"],
      "Mabuhay": ["Purok 1","Purok 2"],
      "Malibas": ["Purok 1","Purok 2","Purok 3"],
      "Mantic": ["Purok 1","Purok 2"],
      "Miputak": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Mohon": ["Purok 1","Purok 2"],
      "Montol": ["Purok 1","Purok 2","Purok 3"],
      "Naburos": ["Purok 1","Purok 2"],
      "Pagawan": ["Purok 1","Purok 2","Purok 3"],
      "Pangayao": ["Purok 1","Purok 2"],
      "Panubigan": ["Purok 1","Purok 2","Purok 3"],
      "Punta": ["Purok 1","Purok 2"],
      "Salimpuno": ["Purok 1","Purok 2","Purok 3"],
      "San Pedro": ["Purok 1","Purok 2"],
      "Santa Ana": ["Purok 1","Purok 2","Purok 3"],
      "Santa Cruz": ["Purok 1","Purok 2"],
      "Santo Niño": ["Purok 1","Purok 2","Purok 3"],
      "Sibucao": ["Purok 1","Purok 2"],
      "Silot Bay": ["Purok 1","Purok 2","Purok 3"],
      "Sumasap": ["Purok 1","Purok 2"],
      "Tagbac": ["Purok 1","Purok 2","Purok 3"],
      "Tiaman": ["Purok 1","Purok 2"],
    }
  },
  "Sapang Dalaga": {
    zip: "7211",
    barangays: {
      "Balintad": ["Purok 1","Purok 2","Purok 3"],
      "Butong": ["Purok 1","Purok 2"],
      "Calidñan": ["Purok 1","Purok 2","Purok 3"],
      "Canibongan Daku": ["Purok 1","Purok 2"],
      "Canibongan Diot": ["Purok 1","Purok 2","Purok 3"],
      "Canubigan": ["Purok 1","Purok 2"],
      "Cautud": ["Purok 1","Purok 2","Purok 3"],
      "Cogon Norte": ["Purok 1","Purok 2"],
      "Cogon Sur": ["Purok 1","Purok 2","Purok 3"],
      "Dansalan": ["Purok 1","Purok 2"],
      "Guilay Norte": ["Purok 1","Purok 2","Purok 3"],
      "Guilay Sur": ["Purok 1","Purok 2"],
      "Guinabot": ["Purok 1","Purok 2","Purok 3"],
      "Langub": ["Purok 1","Purok 2"],
      "Lantad": ["Purok 1","Purok 2","Purok 3"],
      "Linao Norte": ["Purok 1","Purok 2"],
      "Linao Sur": ["Purok 1","Purok 2","Purok 3"],
      "Molicay": ["Purok 1","Purok 2"],
      "Nangcaan": ["Purok 1","Purok 2","Purok 3"],
      "Napaliran": ["Purok 1","Purok 2"],
      "Panabol": ["Purok 1","Purok 2","Purok 3"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Sagua": ["Purok 1","Purok 2"],
      "San Antonio": ["Purok 1","Purok 2","Purok 3"],
      "Santo Niño": ["Purok 1","Purok 2"],
      "Sibucao": ["Purok 1","Purok 2","Purok 3"],
      "Sugbongcogon": ["Purok 1","Purok 2"],
      "Sunrise": ["Purok 1","Purok 2","Purok 3"],
      "Tugaya": ["Purok 1","Purok 2"],
    }
  },
  "Sinacaban": {
    zip: "7215",
    barangays: {
      "Calubo": ["Purok 1","Purok 2","Purok 3"],
      "Caningag": ["Purok 1","Purok 2"],
      "Ciriaco": ["Purok 1","Purok 2","Purok 3"],
      "Del Pilar": ["Purok 1","Purok 2"],
      "Guinabot": ["Purok 1","Purok 2","Purok 3"],
      "Karma": ["Purok 1","Purok 2"],
      "Kiput": ["Purok 1","Purok 2","Purok 3"],
      "Libertad": ["Purok 1","Purok 2"],
      "Lim-oo": ["Purok 1","Purok 2","Purok 3"],
      "Lopoc": ["Purok 1","Purok 2"],
      "Macabog": ["Purok 1","Purok 2","Purok 3"],
      "Magno Octaviano": ["Purok 1","Purok 2"],
      "Mohon": ["Purok 1","Purok 2","Purok 3"],
      "Molugan": ["Purok 1","Purok 2"],
      "Pag-asa": ["Purok 1","Purok 2","Purok 3"],
      "Pisa-an": ["Purok 1","Purok 2"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "Sagay": ["Purok 1","Purok 2"],
      "San Antonio": ["Purok 1","Purok 2","Purok 3"],
      "Sicalao": ["Purok 1","Purok 2"],
      "Silao": ["Purok 1","Purok 2","Purok 3"],
      "Tuyabao": ["Purok 1","Purok 2"],
    }
  },
  "Tudela": {
    zip: "7216",
    barangays: {
      "Aromahan": ["Purok 1","Purok 2","Purok 3"],
      "Balatacan": ["Purok 1","Purok 2"],
      "Camanga": ["Purok 1","Purok 2","Purok 3"],
      "Canibongan": ["Purok 1","Purok 2"],
      "Caningag": ["Purok 1","Purok 2","Purok 3"],
      "Dasan": ["Purok 1","Purok 2"],
      "Guinabot": ["Purok 1","Purok 2","Purok 3"],
      "Guising": ["Purok 1","Purok 2"],
      "Lagutmon": ["Purok 1","Purok 2","Purok 3"],
      "Lamaca": ["Purok 1","Purok 2"],
      "Luyong Bonbon": ["Purok 1","Purok 2","Purok 3"],
      "Luyong Gibon": ["Purok 1","Purok 2"],
      "Malibas": ["Purok 1","Purok 2","Purok 3"],
      "Mantic": ["Purok 1","Purok 2"],
      "Mialen": ["Purok 1","Purok 2","Purok 3"],
      "Mohon": ["Purok 1","Purok 2"],
      "Nailon": ["Purok 1","Purok 2","Purok 3"],
      "Panabol": ["Purok 1","Purok 2"],
      "Panalsalan": ["Purok 1","Purok 2","Purok 3"],
      "Poblacion": ["Purok 1","Purok 2","Purok 3","Purok 4","Purok 5"],
      "San Miguel": ["Purok 1","Purok 2"],
      "Sapad": ["Purok 1","Purok 2","Purok 3"],
      "Taguite": ["Purok 1","Purok 2"],
    }
  },
};

// ── Address selector helpers ──────────────────────────────

function initAddressSelectors() {
  const munSel = document.getElementById('ckMunicipality');
  if (!munSel) return;
  // Populate municipalities sorted: cities first, then municipalities
  const sorted = Object.keys(MIS_OCC).sort((a, b) => {
    const aCity = a.includes('City') ? 0 : 1;
    const bCity = b.includes('City') ? 0 : 1;
    return aCity - bCity || a.localeCompare(b);
  });
  munSel.innerHTML = '<option value="">— Select City / Municipality —</option>' +
    sorted.map(m => `<option value="${m}">${m}</option>`).join('');
  document.getElementById('ckBarangay').innerHTML = '<option value="">— Select Barangay —</option>';
  document.getElementById('ckPurok').innerHTML    = '<option value="">— Select Purok / Sitio —</option>';
  document.getElementById('ckBarangay').disabled  = true;
  document.getElementById('ckPurok').disabled     = true;
  document.getElementById('ckZipRow').style.display = 'none';
}

function onMunicipalityChange() {
  const mun    = document.getElementById('ckMunicipality').value;
  const brgySel = document.getElementById('ckBarangay');
  const brgySearch = document.getElementById('ckBarangaySearch');
  const purokSel = document.getElementById('ckPurok');
  const zipRow   = document.getElementById('ckZipRow');
  const zipDisp  = document.getElementById('ckZipDisplay');

  // Reset barangay search
  if (brgySearch) { brgySearch.value = ''; brgySearch.disabled = true; }
  _closeBrgyDropdown();

  brgySel.innerHTML = '<option value="">— Select Barangay —</option>';
  purokSel.innerHTML = '<option value="">— Select Purok / Sitio —</option>';
  purokSel.disabled  = true;


  if (!mun || !MIS_OCC[mun]) {
    brgySel.disabled = true;
    zipRow.style.display = 'none';
    _syncHiddenAddr();
    return;
  }

  // Fill zip
  const zip = MIS_OCC[mun].zip;
  document.getElementById('ckZip').value = zip;
  zipDisp.textContent = zip + ' — ' + mun + ', Misamis Occidental';
  zipRow.style.display = 'block';

  // Fill hidden select (used by placeOrder legacy)
  const brgys = Object.keys(MIS_OCC[mun].barangays).sort();
  brgySel.innerHTML = '<option value="">— Select Barangay —</option>' +
    brgys.map(b => `<option value="${b}">${b}</option>`).join('');
  brgySel.disabled = false;

  // Enable search
  if (brgySearch) { brgySearch.disabled = false; brgySearch.placeholder = 'Search barangay in ' + mun + '...'; }
  _syncHiddenAddr();
}

function onBarangayChange() {
  const mun    = document.getElementById('ckMunicipality').value;
  const brgy   = document.getElementById('ckBarangay').value;
  const purokSel = document.getElementById('ckPurok');

  purokSel.innerHTML = '<option value="">— Select Purok / Sitio —</option>';
  if (!mun || !brgy || !MIS_OCC[mun]?.barangays[brgy]) {
    purokSel.disabled = true;
    _syncHiddenAddr();
    return;
  }

  const puroks = MIS_OCC[mun].barangays[brgy];
  purokSel.innerHTML = '<option value="">— Select Purok / Sitio —</option>' +
    puroks.map(p => `<option value="${p}">${p}</option>`).join('');
  purokSel.disabled = false;
  _syncHiddenAddr();
}

// ── Barangay Search ────────────────────────────────────────
function onBarangaySearch(query) {
  const mun = document.getElementById('ckMunicipality').value;
  if (!mun || !MIS_OCC[mun]) return;

  const dropdown = document.getElementById('brgyDropdown');
  const brgys = Object.keys(MIS_OCC[mun].barangays).sort();
  const q = query.trim().toLowerCase();

  const filtered = q ? brgys.filter(b => b.toLowerCase().includes(q)) : brgys;

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="brgy-no-result">No barangay found for "${query}"</div>`;
  } else {
    dropdown.innerHTML = filtered.map(b => {
      const highlighted = q
        ? b.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>')
        : b;
      return `<div class="brgy-opt" onclick="selectBarangay('${b.replace(/'/g,"\\'")}')">📍 ${highlighted}</div>`;
    }).join('');
  }

  dropdown.classList.add('open');
}

function selectBarangay(brgy) {
  const searchInput = document.getElementById('ckBarangaySearch');
  const brgySel = document.getElementById('ckBarangay');

  if (searchInput) searchInput.value = brgy;
  if (brgySel) brgySel.value = brgy;

  _closeBrgyDropdown();
  onBarangayChange();
}

function _closeBrgyDropdown() {
  const d = document.getElementById('brgyDropdown');
  if (d) { d.innerHTML = ''; d.classList.remove('open'); }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('brgySearchWrap');
  if (wrap && !wrap.contains(e.target)) _closeBrgyDropdown();
});

// Keyboard nav in dropdown
document.addEventListener('keydown', function(e) {
  const dropdown = document.getElementById('brgyDropdown');
  if (!dropdown || !dropdown.classList.contains('open')) return;
  const opts = dropdown.querySelectorAll('.brgy-opt');
  if (!opts.length) return;
  const cur = dropdown.querySelector('.highlighted');
  let idx = cur ? Array.from(opts).indexOf(cur) : -1;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cur) cur.classList.remove('highlighted');
    idx = (idx + 1) % opts.length;
    opts[idx].classList.add('highlighted');
    opts[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cur) cur.classList.remove('highlighted');
    idx = (idx - 1 + opts.length) % opts.length;
    opts[idx].classList.add('highlighted');
    opts[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (cur) { e.preventDefault(); cur.click(); }
  } else if (e.key === 'Escape') {
    _closeBrgyDropdown();
  }
});

// Sync hidden ckAddr and ckCity from dropdowns for placeOrder()
function _syncHiddenAddr() {
  const mun   = document.getElementById('ckMunicipality')?.value || '';
  // Prefer barangay from hidden select (kept in sync by selectBarangay)
  const brgy  = document.getElementById('ckBarangay')?.value    || '';
  const purok = document.getElementById('ckPurok')?.value       || '';
  const street = document.getElementById('ckStreet')?.value     || '';

  const parts = [];
  if (street) parts.push(street);
  if (purok)  parts.push(purok);
  if (brgy)   parts.push('Brgy. ' + brgy);
  document.getElementById('ckAddr').value = parts.join(', ');
  document.getElementById('ckCity').value = mun ? mun + ', Misamis Occidental' : '';
}

// Also sync on street input
document.addEventListener('DOMContentLoaded', () => {
  const st = document.getElementById('ckStreet');
  if (st) st.addEventListener('input', _syncHiddenAddr);
  const pu = document.getElementById('ckPurok');
  if (pu) pu.addEventListener('change', _syncHiddenAddr);
});

// ── SESSION STATE ──
let cart        = JSON.parse(localStorage.getItem(LS_CART)     || '[]');
let wishlist    = JSON.parse(localStorage.getItem(LS_WISHLIST) || '[]');
let currentUser = JSON.parse(localStorage.getItem(LS_USER)     || 'null');

let currentFilter   = 'all';
let currentSort     = 'default';
let selectedPayment = 'cod';
let currentModalProduct = null;
let modalQty    = 1;
let selectedSize = '';

// Products loaded entirely from Supabase — no hardcoded fallback
let PRODUCTS = [];

// ── SEED PRODUCTS (used as fallback when Supabase returns 0 rows) ──
// These are real-world sports products with searchable names.
// Insert them into Supabase using the SQL in ljmsport-seed.sql
const SEED_PRODUCTS = [
  // ── BASKETBALL ──
  { id:1001, name:'Nike LeBron 21', cat:'Basketball', brand:'Nike', price:8995, emoji:'🏀', badge:'HOT',
    desc:'LeBron James signature shoe with Max Air cushioning and Zoom Air unit in the forefoot for explosive performance on the court.',
    imageUrl:'https://static.nike.com/a/images/t_PDP_1280_v1/lebron-21-basketball-shoes.jpg',
    sizes:['US 7','US 8','US 9','US 10','US 11','US 12'] },
  { id:1002, name:'Air Jordan 37', cat:'Basketball', brand:'Nike', price:10500, emoji:'🏀', badge:'NEW',
    desc:'The Air Jordan 37 features Leno-Weave upper for ventilation and Eclipse Plate 2.0 for responsive cushioning. Built for speed and agility.',
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11'] },
  { id:1003, name:'Molten FIBA 3800 Basketball', cat:'Basketball', brand:'Molten', price:2499, emoji:'🏀', badge:'',
    desc:'Official FIBA-approved basketball with 12-panel pebbled leather for superior grip and consistent bounce. Ideal for competitive play.',
    imageUrl:'',
    sizes:['Size 7'] },
  { id:1004, name:'Adidas Dame 8 EXTPLY', cat:'Basketball', brand:'Adidas', price:6995, emoji:'🏀', badge:'',
    desc:"Damian Lillard's signature shoe built for sharp cuts and explosive drives. Lightstrike Pro midsole delivers incredible energy return.",
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11','US 12'] },
  // ── VOLLEYBALL ──
  { id:1005, name:'Mikasa MVA200 Volleyball', cat:'Volleyball', brand:'Mikasa', price:2899, emoji:'🏐', badge:'HOT',
    desc:'Official FIVB World League volleyball with dimpled surface for higher spin reception. Used in Olympic competitions worldwide.',
    imageUrl:'',
    sizes:['Standard'] },
  { id:1006, name:'Asics Gel-Rocket 10', cat:'Volleyball', brand:'Asics', price:3499, emoji:'🏐', badge:'NEW',
    desc:'Court volleyball shoe with GEL cushioning technology for superior shock absorption. Trusstic System for enhanced structural integrity.',
    imageUrl:'',
    sizes:['US 6','US 7','US 8','US 9','US 10','US 11'] },
  { id:1007, name:'Molten V5M5000 Volleyball', cat:'Volleyball', brand:'Molten', price:3200, emoji:'🏐', badge:'',
    desc:'Premium match volleyball with FIVB Approved design. Japanese Molten quality with soft microfiber leather for pinpoint touch control.',
    imageUrl:'',
    sizes:['Standard'] },
  // ── SOCCER ──
  { id:1008, name:'Adidas Predator Elite FG', cat:'Soccer', brand:'Adidas', price:12500, emoji:'⚽', badge:'HOT',
    desc:'Elite football boots with Hybridtouch upper and CONTROLFRAME outsole. Zone Skin panels provide unrivaled control and precision.',
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11'] },
  { id:1009, name:'Nike Phantom GX Elite FG', cat:'Soccer', brand:'Nike', price:13995, emoji:'⚽', badge:'NEW',
    desc:'ACC (All Conditions Control) technology delivers consistent ball touch in wet or dry conditions. Ghost Lace system for clean strike zone.',
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11'] },
  { id:1010, name:'Puma King Pro FG', cat:'Soccer', brand:'Puma', price:5995, emoji:'⚽', badge:'',
    desc:"Inspired by Puma's legendary King boot. Full kangaroo leather upper for ultimate touch and feel. Lightweight low-profile design.",
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11'] },
  { id:1011, name:'Adidas Al Rihla Pro Soccer Ball', cat:'Soccer', brand:'Adidas', price:3999, emoji:'⚽', badge:'',
    desc:'Official match ball of the FIFA World Cup. Connected ball technology and Speedshell for reduced air resistance at high speed.',
    imageUrl:'',
    sizes:['Size 5'] },
  // ── RUNNING ──
  { id:1012, name:'Nike Air Zoom Pegasus 40', cat:'Running', brand:'Nike', price:5995, emoji:'👟', badge:'',
    desc:'The workhorse trainer for every run. Zoom Air unit in the forefoot and React foam midsole for a springy, cushioned ride all day long.',
    imageUrl:'',
    sizes:['US 6','US 7','US 8','US 9','US 10','US 11','US 12'] },
  { id:1013, name:'Adidas Ultraboost 23', cat:'Running', brand:'Adidas', price:8495, emoji:'👟', badge:'NEW',
    desc:'BOOST midsole with Primeknit+ upper for an incredibly adaptive fit. Continental rubber outsole for superior grip on any surface.',
    imageUrl:'',
    sizes:['US 6','US 7','US 8','US 9','US 10','US 11','US 12'] },
  { id:1014, name:'Under Armour HOVR Phantom 3', cat:'Running', brand:'Under Armour', price:6495, emoji:'👟', badge:'',
    desc:"UA HOVR technology provides 'zero gravity feel' to maintain energy return. Connected shoe with MapMyRun app integration for smart tracking.",
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11'] },
  { id:1015, name:'Puma Velocity Nitro 2', cat:'Running', brand:'Puma', price:4995, emoji:'👟', badge:'SALE',
    desc:'NITRO foam technology for an ultra-light, responsive ride. PWRTAPE bands wrap the foot for stability without added weight.',
    imageUrl:'',
    sizes:['US 6','US 7','US 8','US 9','US 10','US 11'] },
  // ── GYM ──
  { id:1016, name:'Nike Metcon 8 Training Shoes', cat:'Gym', brand:'Nike', price:7495, emoji:'🏋️', badge:'',
    desc:'Stability meets speed. Wide, flat heel for heavy lifting; forefoot flexibility for box jumps and sprints. Rubber wrap for rope climbs.',
    imageUrl:'',
    sizes:['US 7','US 8','US 9','US 10','US 11','US 12'] },
  { id:1017, name:'Under Armour HeatGear Compression Shirt', cat:'Gym', brand:'Under Armour', price:1895, emoji:'💪', badge:'',
    desc:'Ultra-tight second-skin fit that helps muscles perform better and recover faster. HeatGear fabric wicks sweat and dries fast.',
    imageUrl:'',
    sizes:['S','M','L','XL','XXL'] },
  { id:1018, name:'Adidas Gym Sack Bag', cat:'Gym', brand:'Adidas', price:799, emoji:'🎒', badge:'',
    desc:'Lightweight drawstring gym bag in ripstop fabric. External zip pocket for small essentials. Padded back straps for comfort.',
    imageUrl:'',
    sizes:['One Size'] },
  // ── ACCESSORIES ──
  { id:1019, name:'Wilson Pro Staff 97 v14 Tennis Racket', cat:'Accessories', brand:'Wilson', price:11500, emoji:'🎾', badge:'',
    desc:"Roger Federer's racket of choice. Braided graphite construction with FreeFlex and CounterVail technologies for power and control.",
    imageUrl:'',
    sizes:['4 1/4','4 3/8','4 1/2'] },
  { id:1020, name:'Nike Sport Dri-FIT Socks 3-Pack', cat:'Accessories', brand:'Nike', price:599, emoji:'🧦', badge:'',
    desc:'Dri-FIT technology moves sweat away from your skin. Arch support band and cushioned foot bed for all-day athletic comfort.',
    imageUrl:'',
    sizes:['S/M','L/XL'] },
  { id:1021, name:'Adidas 5-Panel Training Cap', cat:'Accessories', brand:'Adidas', price:895, emoji:'🧢', badge:'NEW',
    desc:'Lightweight AEROREADY cap that absorbs moisture. Pre-curved brim and adjustable Velcro closure. UV protection built in.',
    imageUrl:'',
    sizes:['One Size'] },
  { id:1022, name:'Under Armour Hustle 5.0 Backpack', cat:'Accessories', brand:'Under Armour', price:3495, emoji:'🎒', badge:'',
    desc:'Large main compartment, padded laptop sleeve, external water-bottle pockets, and HeatGear-lined shoe pocket to separate dirty gear.',
    imageUrl:'',
    sizes:['One Size'] },
  { id:1023, name:'Molten Handball Size 2', cat:'Accessories', brand:'Molten', price:1899, emoji:'🤾', badge:'',
    desc:'IHF-approved foam rubber handball for training and competition. Excellent grip texture and consistent bounce on indoor courts.',
    imageUrl:'',
    sizes:['Size 2'] },
  { id:1024, name:'Puma Liga Shin Guards', cat:'Accessories', brand:'Puma', price:799, emoji:'🦵', badge:'',
    desc:'Lightweight polypropylene shell with anatomical shaping. EVA foam backing absorbs impact. Velcro backing keeps guards in place.',
    imageUrl:'',
    sizes:['S','M','L'] },
];

// Stock loaded from Supabase
let STOCK = {};   // { productId: { size: qty } }

// In-memory caches for this session
let _myOrders = [];
let _paymentMethods = [];

// ========== INIT ==========
window.onload = async () => {
  // Show loading state while products fetch
  ['featuredGrid','newGrid','shopGrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Loading…</div>';
  });

  // Load products from Supabase first, then render everything
  await loadShopProducts();

  updateCartBadge();
  updateAuthNav();

  // Fetch active payment methods from Supabase
  _paymentMethods = await db_getPayments();

  // Start real-time subscriptions
  startShopSync();
};

// ── Load ALL products and stock from Supabase ────────────
async function loadShopProducts() {
  const [dbProds, dbStock] = await Promise.all([db_getProducts(), db_getAllStock()]);

  // If Supabase returned products, use them; otherwise fall back to seed data
  if (dbProds && dbProds.length > 0) {
    PRODUCTS = dbProds;
    STOCK    = dbStock;
  } else {
    // Seed fallback: map SEED_PRODUCTS shape to the shape the rest of the app expects
    PRODUCTS = SEED_PRODUCTS.map(p => ({
      ...p,
      // Ensure the fields db_getProducts returns are present
      stock_quantity: p.stock_quantity ?? 50,
    }));
    // Build a fake STOCK object so stock-related functions work
    STOCK = {};
    PRODUCTS.forEach(p => {
      STOCK[p.id] = {};
      (p.sizes || ['One Size']).forEach(s => { STOCK[p.id][s] = 50; });
    });
  }

  renderFeatured();
  renderNewArrivals();
  renderShop();
}

function getTotalStock(productId) {
  const s = STOCK[productId] || {};
  return Object.values(s).reduce((a, b) => a + (parseInt(b) || 0), 0);
}

function getSizeStock(productId, size) {
  return (STOCK[productId] || {})[size] ?? 0;
}

// ========== NAVIGATION ==========
function showView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (v === 'history')  renderHistory();
  if (v === 'wishlist') renderWishlist();
  if (v === 'checkout') renderCheckout();
  if (v === 'settings') renderSettings();
  closeSidebar();
}
function nav(v) { showView(v); }
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}
function filterAndNav(cat) {
  currentFilter = cat;
  showView('shop');
  document.querySelectorAll('.filter-tab').forEach(t => { t.classList.toggle('active', t.textContent.includes(cat)); });
  renderShop(cat);
}

// ========== PRODUCTS ==========
function renderFeatured()   {
  const el = document.getElementById('featuredGrid');
  if (!el) return;
  el.innerHTML = PRODUCTS.length
    ? PRODUCTS.slice(0, 8).map(p => productCard(p)).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No products yet.</div>';
}
function renderNewArrivals(){
  const el = document.getElementById('newGrid');
  if (!el) return;
  const newProds = PRODUCTS.filter(p => p.badge === 'NEW');
  el.innerHTML = newProds.length
    ? newProds.map(p => productCard(p)).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No new arrivals yet.</div>';
}

function renderShop(filter = currentFilter, sort = currentSort) {
  let prods = filter === 'all' ? [...PRODUCTS] : PRODUCTS.filter(p => p.cat === filter);
  if (sort === 'price-asc')  prods.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') prods.sort((a, b) => b.price - a.price);
  else if (sort === 'name')  prods.sort((a, b) => a.name.localeCompare(b.name));
  const el = document.getElementById('shopGrid');
  if (el) el.innerHTML = prods.length
    ? prods.map(p => productCard(p)).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No products in this category.</div>';
  const countEl = document.getElementById('shopCount');
  if (countEl) countEl.textContent = `${prods.length} product${prods.length !== 1 ? 's' : ''}`;
}

function filterShop(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderShop(cat, currentSort);
}
function sortShop(val) { currentSort = val; renderShop(currentFilter, val); }

function productCard(p) {
  const inWishlist = wishlist.includes(p.id);
  const badgeClass = p.badge === 'SALE' ? 'sale' : p.badge === 'NEW' ? 'new' : p.badge === 'HOT' ? 'hot' : '';
  const total = getTotalStock(p.id);
  const outOfStock = total === 0;
  const lowStock   = !outOfStock && total <= 5;

  const imgHtml = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="${p.name}" class="product-img-photo">`
    : `<div class="product-img">${p.emoji}</div>`;

  const priceHtml = p.oldPrice
    ? `<div class="product-price"><span class="old">&#8369;${p.oldPrice.toLocaleString()}</span>&#8369;${p.price.toLocaleString()}</div>`
    : `<div class="product-price">&#8369;${p.price.toLocaleString()}</div>`;

  return `
    <div class="product-card${outOfStock ? ' product-card--oos' : ''}" onclick="openProduct(${p.id})">
      ${p.badge ? `<div class="product-badge ${badgeClass}">${p.badge}</div>` : ''}
      ${outOfStock ? '<div class="product-oos-overlay">OUT OF STOCK</div>' : ''}
      ${lowStock ? `<div class="product-low-stock">Only ${total} left!</div>` : ''}
      <button class="wishlist-btn ${inWishlist ? 'active' : ''}" onclick="toggleWishlist(${p.id},event)" aria-label="${inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}">${inWishlist ? '&#10084;&#65039;' : '&#129293;'}</button>
      <div style="position:relative;overflow:hidden">
        ${imgHtml}
      </div>
      <div class="product-body">
        <div class="product-cat">${p.cat}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-brand">${p.brand}</div>
        <div class="product-footer">
          ${priceHtml}
          <span class="view-details-hint">View →</span>
        </div>
      </div>
    </div>`;
}

// ========== PRODUCT MODAL ==========
function openProduct(id) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  currentModalProduct = p; modalQty = 1; selectedSize = p.sizes?.[0] || '';
  const total    = getTotalStock(p.id);
  const outOfStock = total === 0;

  // Show image or emoji
  const imgEl = document.getElementById('modalImg');
  if (p.imageUrl) {
    imgEl.innerHTML = `<img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.parentElement.textContent='${p.emoji}'">`;
  } else {
    imgEl.textContent = p.emoji;
  }

  document.getElementById('modalCat').textContent   = p.cat;
  document.getElementById('modalName').textContent  = p.name;
  document.getElementById('modalBrand').textContent = p.brand;
  document.getElementById('modalPrice').textContent = `₱${p.price.toLocaleString()}`;
  document.getElementById('modalDesc').textContent  = p.desc || '';
  document.getElementById('modalQty').textContent   = modalQty;

  // Sizes with per-size stock
  document.getElementById('modalSizes').innerHTML = (p.sizes || []).map(s => {
    const sQty = getSizeStock(p.id, s);
    const oos  = sQty === 0;
    const low  = !oos && sQty <= 3;
    return `<button class="size-btn ${s === selectedSize ? 'active' : ''} ${oos ? 'size-btn--oos' : ''}"
      onclick="selectSize('${s}',this)"
      ${oos ? 'title="Out of stock"' : ''}>${s}${oos ? ' ✕' : low ? ` (${sQty})` : ''}</button>`;
  }).join('');

  // Stock status banner
  const stockBanner = outOfStock
    ? `<div class="modal-stock-banner modal-stock-banner--oos">⛔ Out of Stock — This product is currently unavailable</div>`
    : total <= 5
      ? `<div class="modal-stock-banner modal-stock-banner--low">⚠️ Low Stock — Only ${total} unit${total !== 1 ? 's' : ''} left across all sizes</div>`
      : '';

  const stockBannerEl = document.getElementById('modalStockBanner');
  if (stockBannerEl) stockBannerEl.innerHTML = stockBanner;

  // Add to cart button
  const addBtn = document.getElementById('modalAddBtn');
  if (addBtn) {
    addBtn.disabled   = outOfStock;
    addBtn.textContent = outOfStock ? 'Out of Stock' : 'Add to Cart';
    addBtn.style.opacity = outOfStock ? '0.45' : '1';
    addBtn.style.cursor  = outOfStock ? 'not-allowed' : 'pointer';
  }

  document.getElementById('modalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.body.style.overflow = '';
  currentModalProduct = null;
}
function selectSize(s, el) { selectedSize = s; document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); }
function changeQty(d) { modalQty = Math.max(1, Math.min(10, modalQty + d)); document.getElementById('modalQty').textContent = modalQty; }
function addToCartFromModal() {
  if (!currentModalProduct) return;
  const p = currentModalProduct;
  // Block if the whole product is OOS
  if (getTotalStock(p.id) === 0) {
    toast(`${p.name} is out of stock`, 'warning'); return;
  }
  // Block if the selected size is OOS
  if (selectedSize && getSizeStock(p.id, selectedSize) === 0) {
    toast(`Size ${selectedSize} is out of stock`, 'warning'); return;
  }
  // Block if requested qty exceeds available stock for the size (or total)
  const avail = selectedSize ? getSizeStock(p.id, selectedSize) : getTotalStock(p.id);
  const inCart = (cart.find(i => i.id === p.id)?.qty || 0);
  if (inCart + modalQty > avail) {
    toast(`Only ${avail} unit${avail !== 1 ? 's' : ''} available${selectedSize ? ' for size ' + selectedSize : ''}`, 'warning'); return;
  }
  for (let i = 0; i < modalQty; i++) addToCart(p.id, true);
  toast(`${p.name} added to cart! 🛒`, 'success');
  closeModal();
}

// ========== CART ==========
function saveCart() { localStorage.setItem(LS_CART, JSON.stringify(cart)); }

function addToCart(id, silent = false) {
  const p = PRODUCTS.find(x => x.id === id); if (!p) return;
  const avail = getTotalStock(id);
  if (avail === 0) {
    toast(`${p.name} is out of stock`, 'warning'); return;
  }
  const existing = cart.find(i => i.id === id);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty + 1 > avail) {
    toast(`Only ${avail} unit${avail !== 1 ? 's' : ''} available for ${p.name}`, 'warning'); return;
  }
  if (existing) existing.qty++;
  else cart.push({ id, qty: 1, name: p.name, price: p.price, emoji: p.emoji, cat: p.cat, brand: p.brand });
  saveCart();
  updateCartBadge();
  if (!silent) toast(`${p.name} added to cart! 🛒`, 'success');
}

function updateCartBadge() {
  document.getElementById('cartBadge').textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function openCart() {
  renderCartPanel();
  document.getElementById('cartPanel').classList.add('open');
  document.getElementById('cartOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartPanel').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function renderCartPanel() {
  const el = document.getElementById('cartItems');
  if (!cart.length) {
    el.innerHTML = `<div class="cart-empty"><div class="empty-icon">🛒</div><p>Your cart is empty</p></div>`;
    document.getElementById('cartSubtotal').textContent = '₱0';
    document.getElementById('cartTotal').textContent    = '₱0';
    return;
  }
  el.innerHTML = cart.map(i => {
    const avail = getTotalStock(i.id);
    const oos   = avail === 0;
    const over  = i.qty > avail && !oos;
    const stockWarn = oos
      ? `<div style="font-size:11px;color:var(--danger);margin-top:3px">⛔ Out of stock — remove to continue</div>`
      : over
        ? `<div style="font-size:11px;color:var(--accent2);margin-top:3px">⚠️ Only ${avail} available</div>`
        : '';
    return `
    <div class="cart-item${oos ? ' cart-item--oos' : ''}">
      <div class="cart-item-img">${i.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-meta">${i.cat}</div>
        ${stockWarn}
        <div class="cart-item-row">
          <span class="cart-item-price">₱${i.price.toLocaleString()}</span>
          <div class="cart-item-qty">
            <button class="cart-qty-btn" onclick="changeCartQty(${i.id},-1)" ${i.qty <= 1 ? 'disabled' : ''}>−</button>
            <span class="cart-qty-num">${i.qty}</span>
            <button class="cart-qty-btn" onclick="changeCartQty(${i.id},1)" ${oos ? 'disabled' : ''}>+</button>
            <button class="cart-remove" onclick="removeFromCart(${i.id})">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cartSubtotal').textContent = `₱${sub.toLocaleString()}`;
  document.getElementById('cartTotal').textContent    = `₱${sub.toLocaleString()}`;
}

function changeCartQty(id, d) {
  const item = cart.find(i => i.id === id); if (!item) return;
  const maxStock = getTotalStock(id);
  const newQty = Math.max(1, item.qty + d);
  if (d > 0 && newQty > maxStock) {
    toast(`Only ${maxStock} unit${maxStock !== 1 ? 's' : ''} available in stock`, 'warning');
    return;
  }
  item.qty = newQty;
  saveCart(); updateCartBadge(); renderCartPanel();
}
function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart(); updateCartBadge(); renderCartPanel();
  toast('Item removed from cart', 'warning');
}

// ========== CHECKOUT ==========
function renderCheckout() {
  const el = document.getElementById('checkoutItems');
  if (!cart.length) { el.innerHTML = '<p style="color:var(--muted);font-size:14px">No items in cart</p>'; return; }
  el.innerHTML = cart.map(i => {
    const prod = PRODUCTS.find(x => x.id === i.id);
    const thumbHtml = prod && prod.imageUrl
      ? `<img src="${prod.imageUrl}" alt="${i.name}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid #333" onerror="this.style.display='none'">`
      : `<div style="width:36px;height:36px;border-radius:6px;background:#1e1e1e;border:1px solid #333;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">${i.emoji}</div>`;
    return `
    <div class="order-item" style="display:flex;align-items:center;gap:10px">
      ${thumbHtml}
      <span style="flex:1">${i.name} × ${i.qty}</span>
      <span>₱${(i.price * i.qty).toLocaleString()}</span>
    </div>`;
  }).join('');
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(sub * 0.12);
  const total = sub + tax;
  document.getElementById('ckSubtotal').textContent = `₱${sub.toLocaleString()}`;
  document.getElementById('ckTax').textContent      = `₱${tax.toLocaleString()}`;
  document.getElementById('ckTotal').textContent    = `₱${total.toLocaleString()}`;
  const preview = document.getElementById('ckTotalPreview');
  if (preview) preview.textContent = `₱${total.toLocaleString()}`;

  // Payment methods from Supabase
  const activePays = _paymentMethods.filter(p => p.status === 'active');
  if (activePays.length) {
    const payEl = document.querySelector('.payment-methods');
    if (payEl) {
      payEl.innerHTML = activePays.map(p => `
        <div class="pay-opt ${selectedPayment === p.id ? 'active' : ''}" onclick="selectPay(this)" data-pay="${p.id}">
          <div class="pay-icon">${p.icon}</div>${p.label}
        </div>`).join('');
    }
  }

  if (currentUser) {
    const f = document.getElementById('ckFirst');
    const l = document.getElementById('ckLast');
    if (f && !f.value) f.value = currentUser.firstName || '';
    if (l && !l.value) l.value = currentUser.lastName  || '';
  }

  // Init cascading address selectors
  initAddressSelectors();
}

function selectPay(el) {
  document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  selectedPayment = el.dataset.pay;
  const cf = document.getElementById('cardFields');
  if (cf) cf.style.display = selectedPayment === 'card' ? 'block' : 'none';
}

// ── PLACE ORDER (writes to Supabase) ──────────────────────
async function placeOrder() {
  if (!cart.length) { toast('Your cart is empty!', 'warning'); return; }

  // ── Pre-flight stock check ──
  const oosItems = cart.filter(i => getTotalStock(i.id) === 0);
  if (oosItems.length) {
    toast(`Remove out-of-stock items before ordering: ${oosItems.map(i => i.name).join(', ')}`, 'warning');
    return;
  }
  const overItems = cart.filter(i => i.qty > getTotalStock(i.id));
  if (overItems.length) {
    toast(`Quantity exceeds available stock for: ${overItems.map(i => i.name).join(', ')}`, 'warning');
    return;
  }

  const fname = document.getElementById('ckFirst')?.value.trim();
  const lname = document.getElementById('ckLast')?.value.trim()  || '';
  const phone = document.getElementById('ckPhone')?.value.trim() || '';

  // Sync hidden fields from dropdowns before reading
  _syncHiddenAddr();
  const addr  = document.getElementById('ckAddr')?.value.trim();
  const city  = document.getElementById('ckCity')?.value.trim();
  const zip   = document.getElementById('ckZip')?.value.trim()   || '';

  const municipality = document.getElementById('ckMunicipality')?.value;
  const barangay     = document.getElementById('ckBarangay')?.value;

  if (!fname)        { toast('Please enter your first name', 'warning'); return; }
  if (!municipality) { toast('Please select your city / municipality', 'warning'); return; }
  if (!barangay)     { toast('Please select your barangay', 'warning'); return; }
  if (!phone)        { toast('Please enter your phone number', 'warning'); return; }
  // Philippine number: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX (13 chars)
  const phPhoneRe = /^(09\d{9}|\+639\d{9})$/;
  if (!phPhoneRe.test(phone.replace(/\s/g,''))) {
    toast('Please enter a valid Philippine number (e.g. 09XXXXXXXXX or +639XXXXXXXXX)', 'warning'); return;
  }

  // ── COD confirmation dialog ──
  if (selectedPayment === 'cod') {
    const confirmed = confirm(
      `📦 Order Confirmation\n\n` +
      `Payment: Cash on Delivery (COD)\n` +
      `You will pay the rider when your order arrives.\n\n` +
      `Deliver to: ${fname} ${lname}\n` +
      `${municipality}, ${barangay}\n\n` +
      `Press OK to confirm your order.`
    );
    if (!confirmed) return;
  }

  const sub   = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax   = Math.round(sub * 0.12);
  const total = sub + tax;
  const orderId = 'LJM-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(-3);

  // ── Payment status label ──
  const paymentStatus = selectedPayment === 'cod' ? 'To Pay on Delivery' : 'Pending';

  const order = {
    id       : orderId,
    date     : new Date().toISOString(),
    status   : 'pending',
    paymentStatus,
    userEmail: currentUser?.email || '',
    items    : cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, emoji: i.emoji, brand: i.brand })),
    total,
    payment  : selectedPayment,
    shipping : { fname, lname, email: currentUser?.email || '', phone, address: addr, city, zip, municipality, barangay, purok: document.getElementById('ckPurok')?.value || '' },
    riderId  : null, riderName: '', riderPhone: '', riderPlate: '', riderStep: null,
  };

  // Save to Supabase via the shared db_saveOrder() helper (uses getSBAsync, handles errors)
  try {
    const saved = await db_saveOrder(order);
    if (!saved) {
      toast('Order failed. Please check your connection and try again.', 'warning');
      return;
    }
  } catch(e) {
    console.error('[placeOrder] exception:', e);
    toast('Order failed. Please try again.', 'warning');
    return;
  }

  // ── Decrement stock using the dedicated helper (per-size upsert, no delete race) ──
  if (typeof db_decrementStock === 'function') {
    await db_decrementStock(cart.map(i => ({ id: i.id, qty: i.qty, size: i.size || 'One Size' })));
    STOCK = await db_getAllStock();
  } else {
    for (const item of cart) {
      const sizeStock = STOCK[item.id] || {};
      const updatedSizes = { ...sizeStock };
      let remaining = item.qty;
      for (const sz of Object.keys(updatedSizes)) {
        if (remaining <= 0) break;
        const available = updatedSizes[sz] || 0;
        const deduct = Math.min(available, remaining);
        updatedSizes[sz] = available - deduct;
        remaining -= deduct;
      }
      if (typeof db_saveProductStock === 'function') {
        await db_saveProductStock(item.id, updatedSizes);
        STOCK[item.id] = updatedSizes;
      }
    }
  }

  // Persist user account to Supabase so admin's Customer table is populated
  if (currentUser) {
    await db_upsertUser({
      email    : currentUser.email,
      name     : `${currentUser.firstName || fname} ${currentUser.lastName || lname}`.trim(),
      phone    : phone || null,
      status   : 'active',
      since    : new Date().toISOString(),
    });
  }

  // Subscribe to this order's real-time status changes for the success page
  _subscribeToMyOrder(orderId);

  cart = []; saveCart(); updateCartBadge();
  document.getElementById('successOrderCode').textContent = `#${orderId}`;
  showView('success');
  toast('Order placed! 🎉', 'success');
}

// Subscribe to a specific order for live tracking on the success/history page
function _subscribeToMyOrder(orderId) {
  db_subscribeOrder(orderId, () => {
    if (document.getElementById('view-history')?.classList.contains('active')) renderHistory();
    else refreshOrderStatusBadges();
  });
}

// ========== ORDER HISTORY (live from Supabase) ==========
async function renderHistory() {
  const allOrders = await db_getOrders();
  const myEmail   = currentUser?.email || '';
  const myOrders  = myEmail
    ? allOrders.filter(o => o.userEmail === myEmail || (o.shipping && o.shipping.email === myEmail))
    : allOrders;   // guest: show all (demo/testing)
  _myOrders = myOrders;

  const el = document.getElementById('historyList');
  if (!myOrders.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:16px">📦</div>
      <p style="font-size:18px;font-weight:600;color:var(--text)">No orders yet</p>
      <p style="margin-top:8px">Start shopping to see your orders here</p>
      <br><button class="btn-primary" onclick="nav('shop')" style="padding:12px 24px">SHOP NOW →</button>
    </div>`;
    return;
  }

  const feedbacks = await db_getFeedbacks();
  el.innerHTML = myOrders.map(o => {
    const addr  = o.shipping ? `${o.shipping.address || ''}, ${o.shipping.city || ''}` : '—';
    const dated = o.date ? new Date(o.date).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—';
    const timed = o.date ? new Date(o.date).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' }) : '';
    const isDelivered = o.status === 'delivered';
    const hasProductReview  = feedbacks.some(f => f.orderId === o.id && f.type === 'product');
    const hasDeliveryReview = feedbacks.some(f => f.orderId === o.id && f.type === 'delivery');
    return `
      <div class="order-card" data-order-id="${o.id}">
        <div class="order-card-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-date">📅 ${dated} ${timed}</span>
          <span class="order-status live-status ${statusCls(o.status)}">${statusLabel(o.status)}</span>
        </div>
        <div class="order-card-body">
          <div class="order-products">${(o.items || []).map(i => `<div class="order-prod-thumb" title="${i.name}">${i.emoji || '📦'}</div>`).join('')}</div>
          <p style="font-size:13px;color:var(--muted);margin-top:8px">📍 ${addr} · 💳 ${(o.payment || '').toUpperCase()} · <span style="color:var(--accent2)">${o.paymentStatus || (o.payment === 'cod' ? 'To Pay on Delivery' : 'Pending')}</span></p>
          <span class="rider-info-live" style="font-size:12px;color:var(--accent2)">${o.riderName ? `🏍 ${o.riderName}` : ''}</span>
        </div>
        <div class="order-card-footer">
          <span style="font-size:13px;color:var(--muted)">${(o.items || []).reduce((s, i) => s + (i.qty || 1), 0)} item(s)</span>
          <span class="order-total">TOTAL: <span>₱${(o.total || 0).toLocaleString()}</span></span>
        </div>
        <div class="order-card-actions" style="display:flex;gap:8px;padding:10px 16px 14px;flex-wrap:wrap">
          <button onclick="openOrderTracker('${o.id}')" style="flex:1;min-width:120px;padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">📦 Track Order</button>
          ${isDelivered && !hasProductReview  ? `<button onclick="openReviewModal('${o.id}','product')"  style="flex:1;min-width:120px;padding:8px 12px;background:#1a2a1a;border:1px solid #2d5a2d;color:#4ade80;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">⭐ Review Product</button>` : ''}
          ${isDelivered && !hasDeliveryReview ? `<button onclick="openReviewModal('${o.id}','delivery')" style="flex:1;min-width:120px;padding:8px 12px;background:#1a1f2a;border:1px solid #2d3d5a;color:#60a5fa;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">🏍 Review Delivery</button>` : ''}
          ${isDelivered && hasProductReview   ? `<span style="flex:1;min-width:120px;padding:8px 12px;text-align:center;font-size:12px;color:var(--muted)">⭐ Product Reviewed</span>` : ''}
          ${isDelivered && hasDeliveryReview  ? `<span style="flex:1;min-width:120px;padding:8px 12px;text-align:center;font-size:12px;color:var(--muted)">✅ Delivery Reviewed</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function statusLabel(s) {
  const map = { pending:'Pending', processing:'Processing', out_for_delivery:'Shipped / Out for Delivery', shipped:'Shipped / Out for Delivery', delivered:'Delivered ✅', cancelled:'Cancelled ❌' };
  return map[s] || s;
}
function statusCls(s) {
  const map = { pending:'status-processing', processing:'status-processing', out_for_delivery:'status-shipped', shipped:'status-shipped', delivered:'status-delivered', cancelled:'status-cancelled' };
  return map[s] || '';
}

// Live status refresh without full re-render
async function refreshOrderStatusBadges() {
  const myEmail = currentUser?.email || '';
  if (!myEmail && !_myOrders.length) return;
  const allOrders = await db_getOrders();
  allOrders.forEach(o => {
    const card = document.querySelector(`[data-order-id="${o.id}"]`);
    if (!card) return;
    const badge   = card.querySelector('.live-status');
    if (badge)    { badge.className = `order-status live-status ${statusCls(o.status)}`; badge.textContent = statusLabel(o.status); }
    const riderEl = card.querySelector('.rider-info-live');
    if (riderEl)  riderEl.textContent = o.riderName ? `🏍 ${o.riderName}` : '';
  });
}

// ========== AUTH  (Supabase-backed) ==========
function switchAuth(tab) {
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

// ── Password hashing via Web Crypto API (SHA-256) ──────────
async function hashPassword(pass) {
  const enc = new TextEncoder().encode(pass);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { toast('Please fill in all fields', 'warning'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email address', 'warning'); return; }

  const user = await db_getUserByEmail(email);
  const hashed = await hashPassword(pass);
  // Support both hashed passwords and legacy plain-text (migration compatibility)
  const passwordMatch = user && (user.password === hashed || user.password === pass);
  if (passwordMatch) {
    if (user.status === 'blocked') { toast('Your account has been blocked. Please contact support.', 'warning'); return; }
    currentUser = { firstName: user.name?.split(' ')[0] || '', lastName: user.name?.split(' ').slice(1).join(' ') || '', email: user.email };
    localStorage.setItem(LS_USER, JSON.stringify(currentUser));
    updateAuthNav();
    toast(`Welcome back, ${currentUser.firstName || 'Athlete'}! 🏆`, 'success');
    nav('home');
  } else {
    toast('Invalid email or password', 'warning');
  }
}

async function doRegister() {
  const first = document.getElementById('regFirst').value.trim();
  const last  = document.getElementById('regLast').value.trim()  || '';
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value;
  const pass2 = document.getElementById('regPass2').value;
  if (!first || !email || !pass) { toast('Please fill in all required fields', 'warning'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email address', 'warning'); return; }
  if (pass !== pass2)            { toast('Passwords do not match', 'warning'); return; }
  if (pass.length < 8)           { toast('Password must be at least 8 characters', 'warning'); return; }

  const existing = await db_getUserByEmail(email);
  if (existing) { toast('Email already registered', 'warning'); return; }

  // Create account directly — no email verification needed
  const hashedPass = await hashPassword(pass);
  await db_upsertUser({
    email,
    name    : `${first} ${last}`.trim(),
    password: hashedPass,
    status  : 'active',
    since   : new Date().toISOString(),
  });

  currentUser = { firstName: first, lastName: last, email };
  localStorage.setItem(LS_USER, JSON.stringify(currentUser));

  updateAuthNav();
  toast(`Welcome to LJMSport, ${first}! 🎉`, 'success');
  nav('home');
}


function signOut() {
  currentUser = null;
  localStorage.removeItem(LS_USER);
  updateAuthNav();
  toast('Signed out successfully', 'warning');
  nav('home');
}

function updateAuthNav() {
  const btn      = document.getElementById('navAuthBtn');
  const sideItem = document.getElementById('sidebarAuthItem');
  if (currentUser) {
    const init = (currentUser.firstName || 'A')[0].toUpperCase();
    if (btn)      { btn.textContent = init; btn.style.borderRadius='50%'; btn.style.width='36px'; btn.style.height='36px'; btn.style.padding='0'; btn.onclick=()=>nav('settings'); }
    if (sideItem) { sideItem.innerHTML = `<span class="icon">👤</span> ${currentUser.firstName}`; sideItem.onclick=()=>nav('settings'); }
  } else {
    if (btn)      { btn.textContent='Sign In'; btn.style=''; btn.onclick=()=>nav('auth'); }
    if (sideItem) { sideItem.innerHTML=`<span class="icon">👤</span> Sign In`; sideItem.onclick=()=>nav('auth'); }
  }
}

// ========== WISHLIST  (localStorage — user-specific) ==========
function saveWishlist() { localStorage.setItem(LS_WISHLIST, JSON.stringify(wishlist)); }
function toggleWishlist(id, e) {
  if (e) e.stopPropagation();
  const idx = wishlist.indexOf(id);
  if (idx >= 0) { wishlist.splice(idx, 1); toast('Removed from wishlist', 'warning'); }
  else          { wishlist.push(id); toast('Added to wishlist ❤️', 'success'); }
  saveWishlist();
  renderFeatured(); renderShop(); renderNewArrivals();
  if (document.getElementById('view-wishlist').classList.contains('active')) renderWishlist();
}
function renderWishlist() {
  const el    = document.getElementById('wishlistGrid');
  const items = PRODUCTS.filter(p => wishlist.includes(p.id));
  if (!items.length) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:16px">🤍</div>
      <p style="font-size:18px;font-weight:600;color:var(--text)">No saved items</p>
      <p style="margin-top:8px">Tap the heart on any product to save it here</p>
      <br><button class="btn-primary" onclick="nav('shop')" style="padding:12px 24px">BROWSE PRODUCTS →</button>
    </div>`;
    return;
  }
  el.innerHTML = items.map(p => productCard(p)).join('');
}

// ========== SEARCH ==========
// Improved: partial matching, brand, category, description, debounced
let _searchTimer = null;
function handleSearch(rawQ) {
  // For very short input, go back to home unless there's something
  if (!rawQ || rawQ.trim().length === 0) {
    return; // don't do anything on blank
  }
  const q = rawQ.trim().toLowerCase();
  if (q.length < 1) return;

  // Debounce: wait 150ms so we don't re-render on every keystroke
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => _execSearch(q, rawQ), 150);
}

function _execSearch(q, rawQ) {
  showView('search');

  // Multi-field partial match search:
  //   1. product name (highest priority)
  //   2. brand name
  //   3. category
  //   4. description
  const results = PRODUCTS.filter(p => {
    const name  = (p.name  || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const cat   = (p.cat   || '').toLowerCase();
    const desc  = (p.desc  || '').toLowerCase();
    return name.includes(q) || brand.includes(q) || cat.includes(q) || desc.includes(q);
  });

  // Sort: exact name match first, then starts-with, then contains
  results.sort((a, b) => {
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    const aExact = an === q ? 0 : an.startsWith(q) ? 1 : 2;
    const bExact = bn === q ? 0 : bn.startsWith(q) ? 1 : 2;
    return aExact - bExact;
  });

  document.getElementById('searchTitle').textContent = `RESULTS FOR "${rawQ.toUpperCase()}" (${results.length})`;
  const el = document.getElementById('searchGrid');
  if (!el) return;
  if (!results.length) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:16px">🔍</div>
      <p style="font-size:18px;font-weight:600;color:var(--text)">No results for &ldquo;${rawQ}&rdquo;</p>
      <p style="margin-top:8px;font-size:14px">Try searching by product name, brand, or category</p>
      <br><button class="btn-secondary" onclick="nav('shop')" style="padding:10px 24px">Browse All Products</button>
    </div>`;
    return;
  }
  el.innerHTML = results.map(p => productCard(p)).join('');
}

// ========== SETTINGS ==========
function switchSettings(panel, el) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('settings-' + panel).classList.add('active');
  el.classList.add('active');
}

async function renderSettings() {
  if (!currentUser) return;
  document.getElementById('settFirst').value = currentUser.firstName || '';
  document.getElementById('settLast').value  = currentUser.lastName  || '';
  document.getElementById('settEmail').value = currentUser.email     || '';
  const init     = (currentUser.firstName || 'A')[0].toUpperCase();
  const allOrders = await db_getOrders();
  const myOrders  = allOrders.filter(o => o.userEmail === currentUser.email || (o.shipping && o.shipping.email === currentUser.email));
  document.getElementById('profileHeader').innerHTML = `
    <div class="profile-header">
      <div class="avatar">${init}</div>
      <div class="profile-info">
        <h2>${currentUser.firstName} ${currentUser.lastName || ''}</h2>
        <p>${currentUser.email}</p>
        <div class="profile-badges">
          <span class="prof-badge gold">⭐ Gold Member</span>
          <span class="prof-badge">📦 ${myOrders.length} Orders</span>
          <span class="prof-badge">❤️ ${wishlist.length} Wishlist</span>
        </div>
      </div>
    </div>`;
}

async function saveProfile() {
  if (!currentUser) return;
  currentUser.firstName = document.getElementById('settFirst').value;
  currentUser.lastName  = document.getElementById('settLast').value;
  currentUser.email     = document.getElementById('settEmail').value;
  localStorage.setItem(LS_USER, JSON.stringify(currentUser));
  await db_upsertUser({
    email: currentUser.email,
    name : `${currentUser.firstName} ${currentUser.lastName}`.trim(),
  });
  updateAuthNav();
  toast('Profile updated! ✅', 'success');
  renderSettings();
}

// ========== ORDER TRACKER  (fetches live from Supabase) ==========
async function openOrderTracker(orderId) {
  const allOrders = await db_getOrders();
  const o = allOrders.find(x => x.id === orderId); if (!o) return;

  const steps = [
    { key:'pending',          icon:'🛒', label:'Order Placed',    desc:'Your order has been received.' },
    { key:'processing',       icon:'📦', label:'Processing',       desc:"We're preparing your items." },
    { key:'out_for_delivery', icon:'🏍', label:'Out for Delivery', desc:'Your order is on its way!' },
    { key:'delivered',        icon:'✅', label:'Delivered',         desc:'Order successfully delivered.' },
  ];
  const ORDER_SEQ  = ['pending','processing','out_for_delivery','delivered'];
  const currentIdx = ORDER_SEQ.indexOf(o.status);

  const existing = document.getElementById('tracker-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tracker-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;display:flex;align-items:flex-end;justify-content:center`;
  const panel = document.createElement('div');
  panel.style.cssText = `background:var(--card-bg,#1a1a1a);border-radius:16px 16px 0 0;width:100%;max-width:520px;padding:28px 24px 40px;border-top:1px solid var(--border,#333)`;
  const dated = o.date ? new Date(o.date).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const addr  = o.shipping ? `${o.shipping.address || ''}, ${o.shipping.city || ''}` : '—';
  panel.innerHTML = `
    <div style="width:40px;height:4px;background:#444;border-radius:2px;margin:0 auto 20px"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
      <div>
        <div style="font-size:11px;color:var(--muted,#888);letter-spacing:.08em;text-transform:uppercase;font-family:monospace">Order ID</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent,#60a5fa)">#${o.id}</div>
        <div style="font-size:12px;color:var(--muted,#888);margin-top:2px">${dated}</div>
      </div>
      <span class="order-status ${statusCls(o.status)}" style="font-size:12px">${statusLabel(o.status)}</span>
    </div>
    ${o.riderName && o.status === 'out_for_delivery' ? `
    <div style="background:#1a2030;border:1px solid #2d3d5a;border-radius:8px;padding:12px 14px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
      <span style="font-size:22px">🏍</span>
      <div>
        <div style="font-size:13px;font-weight:600">${o.riderName}</div>
        <div style="font-size:11px;color:var(--muted,#888)">${o.riderPhone || ''} · ${o.riderPlate || ''}</div>
      </div>
      <div style="margin-left:auto;font-size:11px;color:#60a5fa;font-weight:600">YOUR RIDER</div>
    </div>` : ''}
    <div style="position:relative;padding:8px 0 16px">
      ${steps.map((s, i) => {
        const done    = i < currentIdx || (o.status === 'delivered' && i === 3);
        const current = i === currentIdx && o.status !== 'delivered';
        const color   = (o.status === 'cancelled' && i === currentIdx) ? '#f87171' : done ? '#4ade80' : current ? '#60a5fa' : '#444';
        return `<div style="display:flex;gap:14px;align-items:flex-start">
          <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
            <div style="width:32px;height:32px;border-radius:50%;background:${done||current?color:'#222'};border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:14px">${done ? '✓' : s.icon}</div>
            ${i < steps.length - 1 ? `<div style="width:2px;height:28px;background:${done ? '#4ade80' : '#333'};margin:2px 0"></div>` : ''}
          </div>
          <div style="padding-top:4px">
            <div style="font-size:14px;font-weight:600;color:${done||current?'var(--text,#f0f0f0)':'#666'}">${s.label}</div>
            <div style="font-size:12px;color:${done||current?'var(--muted,#999)':'#444'};margin-top:1px">${s.desc}</div>
          </div>
        </div>`;
      }).join('')}
      ${o.status === 'cancelled' ? `<div style="margin-top:12px;padding:10px 14px;background:#2a1a1a;border:1px solid #5a2d2d;border-radius:6px;color:#f87171;font-size:13px">❌ This order was cancelled.</div>` : ''}
    </div>
    <div style="border-top:1px solid #333;padding-top:14px;margin-top:4px">
      <div style="font-size:11px;color:var(--muted,#888);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;font-family:monospace">Delivery Address</div>
      <div style="font-size:13px">📍 ${addr}</div>
    </div>
    <button onclick="document.getElementById('tracker-overlay').remove()" style="width:100%;margin-top:20px;padding:14px;background:var(--accent,#60a5fa);color:#000;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Close</button>`;
  overlay.appendChild(panel);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ========== REVIEW MODAL  (saves to Supabase feedbacks) ==========
async function openReviewModal(orderId, type) {
  const existing = document.getElementById('review-overlay');
  if (existing) existing.remove();

  const allOrders = await db_getOrders();
  const o = allOrders.find(x => x.id === orderId); if (!o) return;

  const typeLabel  = type === 'product' ? 'Product Review' : 'Delivery Review';
  const typeIcon   = type === 'product' ? '⭐' : '🏍';
  const typeBg     = type === 'product' ? '#1a2a1a' : '#1a1f2a';
  const typeBorder = type === 'product' ? '#2d5a2d' : '#2d3d5a';
  const typeColor  = type === 'product' ? '#4ade80' : '#60a5fa';

  const overlay = document.createElement('div');
  overlay.id = 'review-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px`;
  overlay.innerHTML = `
    <div style="background:var(--card-bg,#1a1a1a);border-radius:12px;width:100%;max-width:440px;padding:28px 24px;border:1px solid #333;position:relative">
      <button onclick="document.getElementById('review-overlay').remove()" style="position:absolute;top:14px;right:14px;background:none;border:none;color:#888;font-size:20px;cursor:pointer">✕</button>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:42px;height:42px;border-radius:8px;background:${typeBg};border:1px solid ${typeBorder};display:flex;align-items:center;justify-content:center;font-size:20px">${typeIcon}</div>
        <div>
          <div style="font-size:16px;font-weight:700">${typeLabel}</div>
          <div style="font-size:12px;color:#888;font-family:monospace">#${orderId}</div>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:12px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Rating</div>
        <div id="star-row" style="display:flex;gap:6px">
          ${[1,2,3,4,5].map(n => `<span data-star="${n}" onclick="setReviewStar(${n})" style="font-size:28px;cursor:pointer;color:#444">★</span>`).join('')}
        </div>
        <input type="hidden" id="review-rating" value="0">
      </div>
      <div style="margin-bottom:18px">
        <div style="font-size:12px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">${type === 'product' ? 'How were the products?' : 'How was the delivery?'}</div>
        <textarea id="review-comment" placeholder="Share your experience..." style="width:100%;height:90px;background:#111;border:1px solid #333;border-radius:6px;color:#f0f0f0;font-size:14px;padding:10px 12px;resize:none;outline:none;font-family:inherit"></textarea>
      </div>
      <button onclick="submitReview('${orderId}','${type}')" style="width:100%;padding:13px;background:${typeColor};color:#000;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">${typeIcon} Submit Review</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function setReviewStar(n) {
  document.getElementById('review-rating').value = n;
  document.querySelectorAll('#star-row [data-star]').forEach(s => {
    const v = parseInt(s.dataset.star);
    s.style.color     = v <= n ? '#facc15' : '#444';
    s.style.transform = v === n ? 'scale(1.2)' : 'scale(1)';
  });
}

async function submitReview(orderId, type) {
  const rating  = parseInt(document.getElementById('review-rating').value);
  const comment = document.getElementById('review-comment').value.trim();
  if (!rating)  { toast('Please select a star rating', 'warning'); return; }
  if (!comment) { toast('Please write a comment', 'warning'); return; }

  const allOrders = await db_getOrders();
  const name = currentUser ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Guest';

  await db_saveFeedback({
    id       : 'FB-' + Date.now(),
    customer : name,
    email    : currentUser?.email || '',
    orderId,
    type,
    rating,
    comment,
  });

  document.getElementById('review-overlay').remove();
  toast(`${type === 'product' ? 'Product' : 'Delivery'} review submitted! Thank you 🙏`, 'success');
  renderHistory();
}

// ========== REAL-TIME SYNC  (Supabase Realtime) ==========
function startShopSync() {
  db_subscribe('orders', () => {
    if (document.getElementById('view-history')?.classList.contains('active')) renderHistory();
    else refreshOrderStatusBadges();
  });

  db_subscribe('payments', async () => {
    _paymentMethods = await db_getPayments();
    if (document.getElementById('view-checkout')?.classList.contains('active')) renderCheckout();
  });

  db_subscribe('products', async () => {
    await loadShopProducts();
  });

  // React to stock changes in real time (e.g. admin updates stock)
  db_subscribe('stock', async () => {
    STOCK = await db_getAllStock();
    renderFeatured();
    renderNewArrivals();
    renderShop();
    // Refresh open modal only if it's currently visible
    if (currentModalProduct && document.getElementById('modalOverlay').classList.contains('show')) {
      openProduct(currentModalProduct.id);
    }
  });
}

// ========== TOAST ==========
function toast(msg, type = 'default') {
  const icons = { success:'✅', warning:'⚠️', default:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
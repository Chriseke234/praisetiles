/**
 * Featured Gospel Music Catalogue for PraiseTiles
 * Real Unsplash gospel/worship concert photography and authentic metadata.
 * Used across the Homepage Discovery, Music Library, and Quick Play selector.
 */

export interface GospelSongItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  bpm: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  modes: ('piano' | 'guitar')[];
  playCount: number;
  likes: number;
  coverUrl: string;
  description: string;
  isTrending?: boolean;
  isCommunity?: boolean;
}

export const FEATURED_GOSPEL_SONGS: GospelSongItem[] = [
  {
    id: 'amazing-grace-anthem',
    title: 'Amazing Grace (Praise Anthem)',
    artist: 'PraiseTiles Sanctuary Orchestra',
    duration: '3:45',
    durationSeconds: 225,
    bpm: 120,
    difficulty: 'Medium',
    modes: ['piano', 'guitar'],
    playCount: 14250,
    likes: 3820,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
    description: 'An uplifting, majestic arrangement of the timeless hymn with synth brass and rhythm pads.',
    isTrending: true,
  },
  {
    id: 'how-great-is-our-god',
    title: 'How Great Is Our God',
    artist: 'Celestial Echoes',
    duration: '4:12',
    durationSeconds: 252,
    bpm: 108,
    difficulty: 'Easy',
    modes: ['piano', 'guitar'],
    playCount: 9810,
    likes: 2430,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
    description: 'Deep resonant piano chords and acoustic guitar flourishes celebrating divine majesty.',
    isTrending: true,
  },
  {
    id: 'way-maker-stride',
    title: 'Way Maker (Gospel Rhythms)',
    artist: 'Zion City Collective',
    duration: '3:58',
    durationSeconds: 238,
    bpm: 128,
    difficulty: 'Hard',
    modes: ['piano', 'guitar'],
    playCount: 18920,
    likes: 5120,
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop',
    description: 'Driving syncopated gospel rhythms with rapid chord progressions and high-energy arpeggios.',
    isTrending: true,
  },
  {
    id: 'holy-forever-symphony',
    title: 'Holy Forever (Acoustic Strings)',
    artist: 'Seraphim Strings',
    duration: '4:30',
    durationSeconds: 270,
    bpm: 96,
    difficulty: 'Medium',
    modes: ['piano', 'guitar'],
    playCount: 7640,
    likes: 1980,
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop',
    description: 'Gentle fingerpicked guitar layers seamlessly merging into full gospel organ chords.',
    isTrending: false,
  },
  {
    id: 'blessed-assurance-stride',
    title: 'Blessed Assurance (Gospel Stride)',
    artist: 'Harlem Praise Revival',
    duration: '3:15',
    durationSeconds: 195,
    bpm: 136,
    difficulty: 'Expert',
    modes: ['piano', 'guitar'],
    playCount: 12430,
    likes: 4150,
    coverUrl: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?q=80&w=600&auto=format&fit=crop',
    description: 'Brisk stride piano with syncopated basslines and electrifying double-time rhythms.',
    isTrending: true,
  },
  {
    id: 'great-is-thy-faithfulness',
    title: 'Great Is Thy Faithfulness',
    artist: 'Aria & Worship Fellowship',
    duration: '3:50',
    durationSeconds: 230,
    bpm: 104,
    difficulty: 'Easy',
    modes: ['piano', 'guitar'],
    playCount: 6540,
    likes: 1720,
    coverUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=600&auto=format&fit=crop',
    description: 'A comforting, warm piano cadence accompanied by soft choir pads and gentle chimes.',
    isCommunity: true,
  },
];

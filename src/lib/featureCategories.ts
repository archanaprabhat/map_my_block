import type { TagType } from './storage';

export type SubTypeOption = {
  id: string;
  labelEn: string;
  labelMl: string;
  geometry: 'Point' | 'LineString';
};

export const FEATURE_CATEGORIES: Record<TagType, { labelEn: string; labelMl: string; subTypes: SubTypeOption[] }> = {
  GoodBuilding: {
    labelEn: 'Good Building',
    labelMl: 'നല്ല കെട്ടിടം',
    subTypes: [
      { id: 'residential', labelEn: 'Residential', labelMl: 'താമസമുള്ള', geometry: 'Point' },
      { id: 'non-residential', labelEn: 'Non-Residential', labelMl: 'താമസേതരം', geometry: 'Point' },
    ]
  },
  Badbuilding: {
    labelEn: 'Dilapidated Building',
    labelMl: 'മോശപ്പെട്ട കെട്ടിടം',
    subTypes: [
      { id: 'dilapidated_residential', labelEn: 'Residential', labelMl: 'താമസമുള്ള', geometry: 'Point' },
      { id: 'dilapidated_non-residential', labelEn: 'Non-Residential', labelMl: 'താമസേതരം', geometry: 'Point' },
    ]
  },
  roads: {
    labelEn: 'Roads & Paths',
    labelMl: 'റോഡുകൾ',
    subTypes: [
      { id: 'good_road', labelEn: 'Good Road', labelMl: 'നല്ല റോഡ്', geometry: 'LineString' },
      { id: 'bad_road', labelEn: 'Bad Road', labelMl: 'മോശപ്പെട്ട റോഡ്', geometry: 'LineString' },
      { id: 'path', labelEn: 'Path', labelMl: 'പാത', geometry: 'LineString' },
      { id: 'railway', labelEn: 'Railway Track', labelMl: 'റെയിൽപാത', geometry: 'LineString' }
    ]
  },
  water: {
    labelEn: 'Water Sources',
    labelMl: 'ജലാശയങ്ങൾ',
    subTypes: [
      { id: 'river', labelEn: 'River', labelMl: 'പുഴ', geometry: 'Point' },
      { id: 'canal', labelEn: 'Canal', labelMl: 'കനാൽ', geometry: 'Point' },
      { id: 'pond', labelEn: 'Pond', labelMl: 'കുളം', geometry: 'Point' },
      { id: 'well', labelEn: 'Well', labelMl: 'കിണർ', geometry: 'Point' },
      { id: 'pipe', labelEn: 'Pipe', labelMl: 'പൈപ്പ്', geometry: 'Point' },
      { id: 'handpipe', labelEn: 'Hand Pipe', labelMl: 'ഹാൻഡ് പൈപ്പ്', geometry: 'Point' }
    ]
  },
  religious: {
    labelEn: 'Religious Centers',
    labelMl: 'ആരാധനാലയങ്ങൾ',
    subTypes: [
      { id: 'temple', labelEn: 'Temple', labelMl: 'ക്ഷേത്രം', geometry: 'Point' },
      { id: 'mosque', labelEn: 'Mosque', labelMl: 'മുസ്ലിം പള്ളി', geometry: 'Point' },
      { id: 'church', labelEn: 'Church', labelMl: 'ക്രിസ്ത്യൻ പള്ളി', geometry: 'Point' },
      { id: 'gurudwara', labelEn: 'Gurudwara', labelMl: 'ഗുരുദ്വാര', geometry: 'Point' }
    ]
  },
  institutions: {
    labelEn: 'Public Institutions',
    labelMl: 'സ്ഥാപനങ്ങൾ',
    subTypes: [
      { id: 'school', labelEn: 'School', labelMl: 'സ്കൂൾ', geometry: 'Point' },
      { id: 'dispensary', labelEn: 'Dispensary', labelMl: 'ഡിസ്പെൻസറി', geometry: 'Point' },
      { id: 'panchayat', labelEn: 'Panchayat Office', labelMl: 'പഞ്ചായത്ത് ഓഫീസ്', geometry: 'Point' },
      { id: 'postoffice', labelEn: 'Post Office', labelMl: 'പോസ്റ്റ് ഓഫീസ്', geometry: 'Point' }
    ]
  }
};

import React, { useState } from 'react';
import { CensusFeature, TagType } from '../lib/storage';
import { ChevronDown, ChevronUp, MapPin, X, Trash2, Edit2 } from 'lucide-react';

export type SubTypeOption = { id: string; labelEn: string; labelMl: string; geometry: 'Point' | 'LineString' };

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

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  features: CensusFeature[];
  onSelectSubType: (type: TagType, subType: SubTypeOption) => void;
  onFlyTo: (feature: CensusFeature) => void;
  onDeleteFeature: (id: string) => void;
  onEditFeature: (feature: CensusFeature) => void;
  language: 'en' | 'ml';
  onToggleLanguage: () => void;
};

export default function SidebarControls({
  isOpen,
  onClose,
  features,
  onSelectSubType,
  onFlyTo,
  onDeleteFeature,
  onEditFeature,
  language,
  onToggleLanguage
}: SidebarProps) {
  const [openCategory, setOpenCategory] = useState<TagType | null>(null);

  const getLabel = (en: string, ml: string) => (language === 'ml' ? ml : en);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-sm bg-white shadow-2xl transform transition-all duration-300 ease-in-out md:relative md:w-[30%] md:max-w-none md:shrink-0 md:border-r md:border-gray-200 flex flex-col ${isOpen ? 'translate-x-0 md:ml-0' : '-translate-x-full md:-ml-[30%]'
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">
            {language === 'en' ? 'Map Tools' : 'മാപ്പ് ടൂളുകൾ'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleLanguage}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              {language === 'en' ? 'മലയാളം' : 'ENG'}
            </button>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
          {/* Categories Accordion */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 px-1">
              {language === 'en' ? 'Add Features' : 'പുതിയവ ചേർക്കുക'}
            </h3>
            <div className="space-y-2">
              {(Object.keys(FEATURE_CATEGORIES) as TagType[]).map((type) => {
                const cat = FEATURE_CATEGORIES[type];
                const isCatOpen = openCategory === type;

                return (
                  <div key={type} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200 hover:border-gray-300">
                    <button
                      className="w-full flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-100/80 transition-colors text-left"
                      onClick={() => setOpenCategory(isCatOpen ? null : type)}
                    >
                      <span className="font-semibold text-gray-800 text-sm">{getLabel(cat.labelEn, cat.labelMl)}</span>
                      {isCatOpen ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                    </button>
                    {isCatOpen && (
                      <div className="p-2 bg-white border-t border-gray-100 grid grid-cols-1 gap-1">
                        {cat.subTypes.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              onSelectSubType(type, sub);
                              onClose();
                            }}
                            className="text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors flex items-center"
                          >
                            <MapPin size={16} className="mr-2 opacity-50" />
                            {getLabel(sub.labelEn, sub.labelMl)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-gray-200 my-4" />

          {/* Live Elements List */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 px-1">
              {language === 'en' ? 'Live Elements' : 'രേഖപ്പെടുത്തിയവ'} ({features.length})
            </h3>
            {features.length === 0 ? (
              <p className="text-sm text-gray-500 italic px-1 bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">
                {language === 'en' ? 'No features drawn yet.' : 'ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.'}
              </p>
            ) : (
              <div className="space-y-2">
                {features.map((f) => (
                  <div key={f.id} className="group flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => onFlyTo(f)}
                    >
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{f.properties.label || 'Unnamed Feature'}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{f.subType.replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEditFeature(f)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => onDeleteFeature(f.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

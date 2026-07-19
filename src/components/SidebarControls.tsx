import React, { useState } from 'react';
import { CensusFeature, TagType } from '../lib/storage';
import { ChevronDown, ChevronUp, X, Trash2, Edit2 } from 'lucide-react';
import { SidebarIcon } from './TagIcons';
import type { SubTypeOption } from '../lib/featureCategories';
import { FEATURE_CATEGORIES } from '../lib/featureCategories';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  features: CensusFeature[];
  onSelectSubType: (type: TagType, subType: SubTypeOption) => void;
  onFlyTo: (feature: CensusFeature) => void;
  onDeleteFeature: (id: string) => void;
  onEditFeature: (feature: CensusFeature) => void;
  onUpdateFeature: (id: string, label: string) => void;
  language: 'en' | 'ml';
  onToggleLanguage: () => void;
};

function SidebarControls({
  isOpen,
  onClose,
  features,
  onSelectSubType,
  onFlyTo,
  onDeleteFeature,
  onEditFeature,
  onUpdateFeature,
  language,
  onToggleLanguage
}: SidebarProps) {
  const [openCategory, setOpenCategory] = useState<TagType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const getLabel = (en: string, ml: string) => (language === 'ml' ? ml : en);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[1900] bg-black/40 backdrop-blur-sm transition-opacity md:z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-[2000] flex w-full max-w-sm transform flex-col bg-white shadow-2xl transition-all duration-300 ease-in-out md:relative md:z-50 md:max-w-none md:shrink-0 md:border-r md:border-gray-200 ${
          isOpen
            ? 'translate-x-0 md:ml-0 md:w-[30%]'
            : 'pointer-events-none -translate-x-full md:pointer-events-auto md:ml-0 md:w-0 md:overflow-hidden md:border-0'
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

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain bg-white p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
                            type="button"
                            onClick={() => {
                              onSelectSubType(type, sub);
                              // Close drawer on phone so the map is tappable; keep panel open on desktop
                              if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
                                onClose();
                              }
                            }}
                            className="flex items-center rounded-lg px-3 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100"
                          >
                            <SidebarIcon type={type} subType={sub.id} />
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
                    {editingId === f.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onUpdateFeature(f.id, editValue);
                              setEditingId(null);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-black"
                        />
                        <button
                          onClick={() => {
                            onUpdateFeature(f.id, editValue);
                            setEditingId(null);
                          }}
                          className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-medium"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => onFlyTo(f)}
                        >
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{f.properties.label || 'Unnamed Feature'}</p>
                          <p className="text-xs text-gray-500 capitalize mt-0.5">{f.subType.replace('_', ' ')}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(f.id);
                              setEditValue(f.properties.label || '');
                              onEditFeature(f);
                            }}
                            className="rounded-lg p-2 text-black transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteFeature(f.id)}
                            className="rounded-lg p-2 text-black transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
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

export default React.memo(SidebarControls);

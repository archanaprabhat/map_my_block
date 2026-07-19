import React from 'react';
import type { TagType, CensusFeature } from '../lib/storage';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { getSvgString, tagColors } from '../lib/tagSvg';
export { tagColors } from '../lib/tagSvg';

const primaryColor = '#212121';
export const createTagIcon = (tag: CensusFeature) => {
  const svgString = getSvgString(tag.type, tag.subType);
  const scale = Math.min(2.5, Math.max(0.7, Number(tag.properties.iconScale) || 1));
  const base = 34;
  const size = Math.round(base * scale);
  const fontSize = Math.max(10, Math.round(12 * scale));

  let html = `<span style="background:${tagColors[tag.type] ?? primaryColor};display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;font-size:${fontSize}px;color:#fff;font-weight:700;">${tag.properties.label ?? ''}</span>`;

  if (svgString) {
    html = `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <div style="width:100%;height:100%;">${svgString}</div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: ${fontSize}px; font-weight: bold; pointer-events: none; text-shadow: 0 0 2px #000;">${tag.properties.label ?? ''}</div>
      </div>
    `;
  }

  return L.divIcon({
    className: 'census-tag-icon',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

export const SidebarIcon = ({ type, subType }: { type: TagType; subType: string }) => {
  const svgString = getSvgString(type, subType);
  if (svgString) {
    return (
      <div
        className="w-5 h-5 mr-2 shrink-0"
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
    );
  }
  return <MapPin size={16} className="mr-2 opacity-50 shrink-0" />;
};

export const getLinePattern = (type: TagType, subType: string): L.Pattern[] => {
  const svgString = getSvgString(type, subType);
  if (!svgString) return [];

  const iconSize = 25;
  const rotatedHtml = `
    <div style="width: 100%; height: 100%; transform: rotate(90deg); display: flex; align-items: center; justify-content: center;">
      ${svgString}
    </div>
  `;

  const icon = L.divIcon({
    html: rotatedHtml,
    className: 'line-decorator-icon',
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2]
  });

  return [
    {
      offset: 0,
      repeat: `${iconSize}px`,
      symbol: L.Symbol.marker({
        rotate: true,
        markerOptions: {
          icon: icon
        }
      })
    }
  ];
};

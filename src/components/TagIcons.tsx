import React from 'react';
import { TagType, CensusFeature } from '../lib/storage';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

const primaryColor = '#212121';
export const tagColors: Record<TagType, string> = {
  GoodBuilding: primaryColor,
  Badbuilding: '#ef4444',
  roads: '#16a34a',
  water: '#2563eb',
  religious: '#d97706',
  institutions: '#9333ea'
};

export const getSvgString = (type: TagType, subType: string) => {
  if (type === 'GoodBuilding' && subType === 'residential') {
    return `<svg fill="#000000" viewBox="-25.6 -25.6 307.20 307.20" id="Flat" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.00256"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="4.096"></g><g id="SVGRepo_iconCarrier"> <path d="M208,220H48a12.01367,12.01367,0,0,1-12-12V48A12.01359,12.01359,0,0,1,48,36H208a12.01359,12.01359,0,0,1,12,12V208A12.01367,12.01367,0,0,1,208,220ZM48,44a4.00458,4.00458,0,0,0-4,4V208a4.00458,4.00458,0,0,0,4,4H208a4.00458,4.00458,0,0,0,4-4V48a4.00458,4.00458,0,0,0-4-4Z"></path> </g></svg>`;
  }
  if (type === 'GoodBuilding' && subType === 'non-residential') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25.6 -25.6 307.2 307.2" fill="none">
    <defs>
        <pattern id="diagonalHatch" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="28" height="28" fill="white"/>
            <rect width="10" height="28" fill="#000"/>
        </pattern>
    </defs>
    <rect x="40" y="40" width="176" height="176" rx="4" ry="4" fill="url(#diagonalHatch)" stroke="#000" stroke-width="8"/>
</svg>`;
  }
  if (type === 'Badbuilding' && subType === 'dilapidated_residential') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25.6 -25.6 307.2 307.2" fill="none">
    <path d="M128 44 L212 212 H44 Z" fill="white" stroke="#000" stroke-width="8" stroke-linejoin="round"/>
</svg>`;
  }
  if (type === 'Badbuilding' && subType === 'dilapidated_non-residential') {
    return `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-25.6 -25.6 307.2 307.2"
    fill="none">

    <defs>
        <pattern
            id="diagonalHatch"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)">
            <rect width="28" height="28" fill="white"/>
            <rect width="10" height="28" fill="#000"/>
        </pattern>
    </defs>

    <path
        d="M128 44 L212 212 H44 Z"
        fill="url(#diagonalHatch)"
        stroke="#000"
        stroke-width="8"
        stroke-linejoin="round"/>

</svg>`;
  }
  if (type === 'roads' && subType === 'good_road') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <line
        x1="20"
        y1="108"
        x2="236"
        y2="108"
        stroke="#000"
        stroke-width="6"
        stroke-linecap="round"/>

    <line
        x1="20"
        y1="148"
        x2="236"
        y2="148"
        stroke="#000"
        stroke-width="6"
        stroke-linecap="round"/>

</svg>`;
  }
  if (type === 'roads' && subType === 'bad_road') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Top dashed line -->
    <line
        x1="20"
        y1="100"
        x2="236"
        y2="100"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray="18 18"/>

    <!-- Bottom dashed line -->
    <line
        x1="20"
        y1="156"
        x2="236"
        y2="156"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray="18 18"/>

</svg>`;
  }
  if (type === 'roads' && subType === 'path') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <line
        x1="20"
        y1="128"
        x2="236"
        y2="128"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray="16 14"/>

</svg>`;
  }
  if (type === 'roads' && subType === 'railway') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Main horizontal line -->
    <line
        x1="12"
        y1="128"
        x2="244"
        y2="128"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Vertical cross ties -->
    <g stroke="#000" stroke-width="8" stroke-linecap="round">
        <line x1="28"  y1="104" x2="28"  y2="152"/>
        <line x1="48"  y1="104" x2="48"  y2="152"/>
        <line x1="68"  y1="104" x2="68"  y2="152"/>
        <line x1="88"  y1="104" x2="88"  y2="152"/>
        <line x1="108" y1="104" x2="108" y2="152"/>
        <line x1="128" y1="104" x2="128" y2="152"/>
        <line x1="148" y1="104" x2="148" y2="152"/>
        <line x1="168" y1="104" x2="168" y2="152"/>
        <line x1="188" y1="104" x2="188" y2="152"/>
        <line x1="208" y1="104" x2="208" y2="152"/>
        <line x1="228" y1="104" x2="228" y2="152"/>
    </g>

</svg>`;
  }
  if (type === 'water' && subType === 'river') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Upper main rail -->
    <path
        d="
        M18 105
        C45 100 70 95 95 95
        L145 95
        C160 95 170 96 180 98
        "
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Upper diverging rail -->
    <path
        d="
        M180 98
        C195 90 210 76 226 65
        C236 58 245 54 252 52
        "
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Upper inside rail -->
    <path
        d="
        M192 122
        C206 116 218 100 230 90
        C239 82 247 78 252 75
        "
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Lower main rail -->
    <path
        d="
        M18 170
        C55 166 90 160 130 160
        C160 160 180 165 198 168
        C215 170 233 162 252 150
        "
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Lower branch -->
    <path
        d="
        M180 128
        C193 130 205 136 218 140
        C231 144 242 141 252 136
        "
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

</svg>`;
  }
  if (type === 'water' && subType === 'canal') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Bottom main line -->
    <path
        d="M20 165 H240"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Upper left line -->
    <path
        d="M20 105 H125"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Vertical connector -->
    <path
        d="M125 105 V55"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Top branch -->
    <path
        d="M125 55 H240"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Middle branch -->
    <path
        d="M150 80 H240"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Lower branch -->
    <path
        d="M150 130 H240"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Inner vertical connector -->
    <path
        d="M150 80 V130"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

</svg>`;
  }
  if (type === 'water' && subType === 'pond') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Pond outline -->
    <path
        d="
        M35 128
        C35 95, 60 80, 95 80
        L125 80
        C145 80, 155 92, 175 96
        L220 96
        C240 96, 250 100, 260 108
        L275 118
        L260 138
        C250 146, 240 150, 220 150
        L175 150
        C155 154, 145 166, 125 166
        L95 166
        C60 166, 35 160, 35 128
        Z"
        stroke="#000"
        stroke-width="6"
        fill="none"
        stroke-linejoin="round"/>

    <!-- Top dashed line -->
    <line x1="60" y1="98" x2="245" y2="98"
          stroke="#000"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray="10 12"/>

    <!-- Middle dashed line -->
    <line x1="50" y1="123" x2="255" y2="123"
          stroke="#000"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray="10 12"/>

    <!-- Bottom dashed line -->
    <line x1="60" y1="148" x2="245" y2="148"
          stroke="#000"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray="10 12"/>

</svg>`;
  }
  if (type === 'water' && subType === 'well') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2">

    <!-- Outer ring -->
    <circle
        cx="128"
        cy="128"
        r="48"
        fill="none"
        stroke="#000"
        stroke-width="8"/>

    <!-- Irregular filled center -->
    <path
        d="M128 108
           C118 108 111 115 111 125
           C111 137 120 147 128 148
           C138 148 146 141 146 129
           C146 117 138 108 128 108Z"
        fill="#000"/>

</svg>`;
  }
  if (type === 'water' && subType === 'pipe') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Handle -->
    <rect x="108" y="48" width="40" height="8" rx="3" fill="#000"/>

    <!-- Stem -->
    <rect x="124" y="56" width="8" height="24" rx="3" fill="#000"/>

    <!-- Valve body -->
    <circle cx="128" cy="96" r="8" fill="#000"/>

    <!-- Horizontal pipe -->
    <path
        d="M128 96
           H92
           Q82 96 82 106
           V120"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Nozzle -->
    <rect x="76" y="120" width="12" height="18" rx="2" fill="#000"/>

    <!-- Right body -->
    <line
        x1="128"
        y1="96"
        x2="158"
        y2="96"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Bottom valve -->
    <line
        x1="128"
        y1="96"
        x2="128"
        y2="118"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <circle cx="128" cy="122" r="5" fill="#000"/>

</svg>`;
  }
  if (type === 'water' && subType === 'handpipe') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Pump body -->
    <rect
        x="118"
        y="95"
        width="20"
        height="90"
        rx="3"
        fill="#000"/>

    <!-- Top stem -->
    <rect
        x="123"
        y="58"
        width="10"
        height="38"
        rx="2"
        fill="#000"/>

    <!-- Handle -->
    <rect
        x="103"
        y="48"
        width="50"
        height="8"
        rx="4"
        fill="#000"/>

    <!-- Lever -->
    <path
        d="M135 62
           L172 95
           L184 145"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Spout -->
    <path
        d="M118 110
           H88
           Q78 110 78 120
           V132"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

</svg>`;
  }
  if (type === 'religious' && subType === 'temple') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Temple body -->
    <rect
        x="70"
        y="90"
        width="116"
        height="126"
        rx="4"
        stroke="#000"
        stroke-width="8"/>

    <!-- Roof -->
    <path
        d="M70 90
           L128 48
           L186 90"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Roof band -->
    <line
        x1="82"
        y1="104"
        x2="174"
        y2="104"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Door -->
    <rect
        x="112"
        y="145"
        width="32"
        height="71"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- Flag pole -->
    <line
        x1="128"
        y1="20"
        x2="128"
        y2="48"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Flag -->
    <path
        d="M128 20
           L168 20
           L156 30
           L168 40
           L128 40"
        fill="#000"/>

</svg>`;
  }
  if (type === 'religious' && subType === 'mosque') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Building -->
    <rect
        x="64"
        y="92"
        width="128"
        height="124"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- Dome -->
    <path
        d="M80 92
           Q128 46 176 92"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Roof line -->
    <line
        x1="70"
        y1="104"
        x2="186"
        y2="104"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Door -->
    <path
        d="M114 216
           V150
           H142
           V216"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Minaret -->
    <line
        x1="128"
        y1="46"
        x2="128"
        y2="14"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

</svg>`;
  }
  if (type === 'religious' && subType === 'church') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Church body -->
    <rect
        x="64"
        y="104"
        width="128"
        height="112"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- Roof -->
    <path
        d="M64 104
           L128 48
           L192 104"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Horizontal band inside roof -->
    <path
        d="M90 76
           H166"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Roof base -->
    <line
        x1="64"
        y1="104"
        x2="192"
        y2="104"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Door -->
    <path
        d="M112 216
           V156
           A16 16 0 0 1 144 156
           V216"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Cross -->
    <line
        x1="128"
        y1="12"
        x2="128"
        y2="48"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <line
        x1="114"
        y1="24"
        x2="142"
        y2="24"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

</svg>`;
  }
  if (type === 'religious' && subType === 'gurudwara') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Building -->
    <rect
        x="64"
        y="104"
        width="128"
        height="112"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- Dome -->
    <path
        d="M64 104
           Q128 52 192 104"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

    <!-- Roof line -->
    <line
        x1="64"
        y1="104"
        x2="192"
        y2="104"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Nishan Sahib pole -->
    <line
        x1="128"
        y1="52"
        x2="128"
        y2="24"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"/>

    <!-- Khanda (simplified to match sketch) -->
    <circle
        cx="128"
        cy="12"
        r="14"
        stroke="#000"
        stroke-width="8"/>

    <line
        x1="128"
        y1="6"
        x2="128"
        y2="18"
        stroke="#000"
        stroke-width="6"
        stroke-linecap="round"/>

    <!-- Door -->
    <path
        d="M114 216
           V152
           H142
           V216"
        stroke="#000"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"/>

</svg>`;
  }
  if (type === 'institutions' && subType === 'school') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- School Building -->
    <rect
        x="56"
        y="56"
        width="144"
        height="144"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- S in bottom-left corner -->
    <text
        x="72"
        y="184"
        font-size="64"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        fill="#000"
        text-anchor="start"
        dominant-baseline="alphabetic">
        S
    </text>

</svg>`;
  }
  if (type === 'institutions' && subType === 'dispensary') {
    return `
    <svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Building -->
    <rect
        x="56"
        y="56"
        width="144"
        height="144"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- D in bottom-left corner -->
    <text
        x="72"
        y="184"
        font-size="64"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        fill="#000"
        text-anchor="start"
        dominant-baseline="alphabetic">
        D
    </text>

</svg>`;
  }
  if (type === 'institutions' && subType === 'panchayat') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Building -->
    <rect
        x="56"
        y="56"
        width="144"
        height="144"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- P in bottom-left corner -->
    <text
        x="72"
        y="184"
        font-size="64"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        fill="#000"
        text-anchor="start"
        dominant-baseline="alphabetic">
        P
    </text>

</svg>`;
  }
  if (type === 'institutions' && subType === 'postoffice') {
    return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="-25.6 -25.6 307.2 307.2"
     fill="none">

    <!-- Building -->
    <rect
        x="56"
        y="56"
        width="144"
        height="144"
        rx="2"
        stroke="#000"
        stroke-width="8"/>

    <!-- PO -->
    <text
        x="128"
        y="184"
        font-size="64"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        fill="#000"
        text-anchor="middle"
        dominant-baseline="alphabetic">
        PO
    </text>

</svg>`;
  }


  // Return null if no custom SVG is defined
  return null;
};

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
        className="w-5 h-5 mr-2 flex-shrink-0"
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
    );
  }
  return <MapPin size={16} className="mr-2 opacity-50 flex-shrink-0" />;
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

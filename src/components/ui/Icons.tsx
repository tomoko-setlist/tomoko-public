export const ChevronDownIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

export const ChevronUpIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
)

export const XIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
)

export const FilterIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  </svg>
)

export const PlayListSearchIcon = ({
  className = 'w-5 h-5',
  'aria-label': ariaLabel,
}: {
  className?: string
  'aria-label'?: string
}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={ariaLabel}
  >
    <path d="M15.8787 4.87866H3.87872V6.87866H15.8787V4.87866Z" fill="currentColor" />
    <path d="M15.8787 8.87866H3.87872V10.8787H15.8787V8.87866Z" fill="currentColor" />
    <path d="M3.87872 12.8787H11.8787V14.8787H3.87872V12.8787Z" fill="currentColor" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.7574 12.7573C12.5858 13.9289 12.5858 15.8284 13.7574 17C14.681 17.9236 16.0571 18.1191 17.1722 17.5864L18.7071 19.1213L20.1213 17.7071L18.5864 16.1722C19.1191 15.057 18.9236 13.681 18 12.7573C16.8284 11.5858 14.9289 11.5858 13.7574 12.7573ZM15.1716 15.5858C15.5621 15.9763 16.1953 15.9763 16.5858 15.5858C16.9763 15.1952 16.9763 14.5621 16.5858 14.1716C16.1953 13.781 15.5621 13.781 15.1716 14.1716C14.7811 14.5621 14.7811 15.1952 15.1716 15.5858Z"
      fill="currentColor"
    />
  </svg>
)

export const ResetIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor" className={className}>
    <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
  </svg>
)

export const DownloadIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v11m0 0l4-4m-4 4l-4-4M4 20h16" />
  </svg>
)

export const LinkIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 13a5 5 0 007.07 0l2.12-2.12a5 5 0 10-7.07-7.07L10.59 5.34m2.82 5.32a5 5 0 00-7.07 0l-2.12 2.12a5 5 0 107.07 7.07l1.53-1.53"
    />
  </svg>
)

export const ShareIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l8-5m-8 5l8 5M8 12a3 3 0 11-6 0 3 3 0 016 0zm14-5a3 3 0 11-6 0 3 3 0 016 0zm0 10a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

export const SearchIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

export const BellIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
    />
  </svg>
)

export const EyeIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z" />
    <circle cx="12" cy="12" r="3" strokeWidth={2} />
  </svg>
)

export const KrnPreviewIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg role="img" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" className={className} fill="currentColor">
    <path d="m 11.907543,12.959104 c -0.06058,-0.022 -0.116015,-0.04 -0.123185,-0.04 -0.0072,-3e-4 -0.553519,-0.5404 -1.214103,-1.2003 l -1.2010619,-1.1999 -0.205234,0.1246 c -1.399224,0.8494 -3.21628,0.6059 -4.352596,-0.5835 -0.893027,-0.9346996 -1.20152,-2.3149996 -0.791156,-3.5398996 0.407772,-1.2171 1.466529,-2.1218 2.743776,-2.3445 0.301964,-0.053 0.870542,-0.053 1.172506,0 1.473948,0.257 2.6174519,1.396 2.8736979,2.8624 0.05842,0.3343 0.05754,0.8981 -0.0019,1.2098 -0.09351,0.4904 -0.28153,0.9595 -0.532949,1.3298 l -0.112145,0.1651 1.156181,1.1542996 c 0.6359,0.6348 1.189303,1.2099 1.229782,1.278 0.08648,0.1453 0.09758,0.3725 0.02503,0.5124 -0.08972,0.1731 -0.319089,0.316 -0.501444,0.3125 -0.03029,-5e-4 -0.104639,-0.019 -0.16522,-0.041 z m -4.2016859,-2.7536 c 0.370012,-0.035 0.893972,-0.2546996 1.234431,-0.5172996 0.431914,-0.3331 0.76073,-0.8249 0.916022,-1.3701 0.07552,-0.2651 0.103081,-0.7977 0.05629,-1.0878 -0.20305,-1.2587 -1.290351,-2.1865 -2.562369,-2.1865 -1.169254,0 -2.2018,0.7924 -2.510899,1.9269 -0.05512,0.2023 -0.06354,0.2957 -0.06208,0.6884 0.0015,0.4125 0.0085,0.4767 0.07598,0.6966 0.314012,1.024 1.192842,1.7612996 2.219139,1.8617996 0.232117,0.023 0.276822,0.022 0.633479,-0.012 z m -1.815061,-1.4448996 0,-0.2203 1.708238,0 1.708238,0 -0.03269,0.062 c -0.01798,0.034 -0.08083,0.1332 -0.139678,0.2203 l -0.10699,0.1583 -1.56856,0 -1.56856,0 0,-0.2203 z m 0,-1.0464 0,-0.2203 1.803647,0 1.803648,0 0,0.1342 c 0,0.074 -0.0077,0.173 -0.01721,0.2203 l -0.01721,0.086 -1.786437,0 -1.786437,0 0,-0.2203 z m 0,-0.9914 0,-0.2202 1.636182,0 1.636182,0 0.05543,0.09 c 0.03049,0.049 0.08062,0.1484 0.111414,0.2202 l 0.05598,0.1307 -1.747595,0 -1.747596,0 0,-0.2203 z m -3.786282,5.6711996 c -0.323505,-0.1054 -0.573725,-0.36 -0.675163,-0.687 -0.0549,-0.177 -0.05543,-0.2331 -0.04815,-5.0406996 l 0.0074,-4.8616 0.103878,-0.2102 c 0.154282,-0.3121 0.395347,-0.5014 0.72969,-0.5729 0.08435,-0.018 1.148539,-0.025 3.021556,-0.02 2.781281,0.01 2.89606,0.01 3.015258,0.06 0.06815,0.029 0.175595,0.088 0.23876,0.1307 0.170716,0.1155 1.7720699,1.7924 1.8632529,1.9512 0.141937,0.2471 0.155305,0.3533 0.155661,1.237 l 3.28e-4,0.811 -0.240946,-0.2581 -0.240945,-0.258 -0.01377,-0.3488 c -0.01295,-0.328 -0.01847,-0.3556 -0.09257,-0.4624 -0.141527,-0.2041 -0.225057,-0.2257 -0.873023,-0.226 -0.536804,-2e-4 -0.56926,0 -0.705485,-0.067 -0.09879,-0.046 -0.166675,-0.1025 -0.220293,-0.1835 l -0.0775,-0.117 -0.01377,-0.7181 c -0.0153,-0.798 -0.0241,-0.8393 -0.202223,-0.9494 -0.09321,-0.058 -0.09937,-0.058 -2.802517,-0.057 -2.569812,5e-4 -2.714768,0 -2.819251,0.051 -0.131014,0.06 -0.189725,0.1215 -0.246779,0.2581 -0.03756,0.09 -0.04236,0.6407 -0.04236,4.867 0,4.2262996 0.0048,4.7769996 0.04236,4.8668996 0.05705,0.1366 0.115765,0.198 0.246779,0.2582 0.105117,0.048 0.276128,0.051 3.744978,0.051 3.552111,0 3.637337,-10e-4 3.744977,-0.054 0.06058,-0.03 0.13165,-0.069 0.157932,-0.089 0.04162,-0.03 0.07116,-0.012 0.228876,0.1439 l 0.18109,0.1786 -0.126429,0.1154 c -0.06954,0.063 -0.197314,0.144 -0.28395,0.179 l -0.157519,0.064 -3.717441,0.01 c -3.621363,0 -3.721711,0 -3.88266,-0.048 z" />
  </svg>
)

export const EditIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-7.5a2.121 2.121 0 113 3L12 17l-4 1 1-4 8.5-8.5z"
    />
  </svg>
)

export const ArrowLeftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

export const DoubleArrowLeftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
)

export const DoubleArrowRightIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
)

export const IndentIncreaseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="square" strokeWidth={2} d="M11 5h9M11 12h9M11 19h9" />
    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="m4 8 4 4-4 4" />
  </svg>
)

export const IndentDecreaseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="square" strokeWidth={2} d="M11 5h9M11 12h9M11 19h9" />
    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="m8 8-4 4 4 4" />
  </svg>
)

export const PlusIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
  </svg>
)

export const SparklesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z" />
  </svg>
)

export const LightbulbIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth={2}
      d="M9 18h6M10 22h4M8.5 14.5C6.9 13.3 6 11.6 6 9.8 6 6.5 8.7 4 12 4s6 2.5 6 5.8c0 1.8-.9 3.5-2.5 4.7-.8.6-1.5 1.5-1.5 2.5h-4c0-1-.7-1.9-1.5-2.5Z"
    />
  </svg>
)

export const MinusIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
  </svg>
)

export const TrashIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a2 2 0 002 2h6a2 2 0 002-2V7M10 11v6m4-6v6" />
  </svg>
)

export const GripVerticalIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
)

export const EventIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
    <path d="m368-320 112-84 110 84-42-136 112-88H524l-44-136-44 136H300l110 88-42 136ZM160-160q-33 0-56.5-23.5T80-240v-135q0-11 7-19t18-10q24-8 39.5-29t15.5-47q0-26-15.5-47T105-556q-11-2-18-10t-7-19v-135q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v135q0 11-7 19t-18 10q-24 8-39.5 29T800-480q0 26 15.5 47t39.5 29q11 2 18 10t7 19v135q0 33-23.5 56.5T800-160H160Zm0-80h640v-102q-37-22-58.5-58.5T720-480q0-43 21.5-79.5T800-618v-102H160v102q37 22 58.5 58.5T240-480q0 43-21.5 79.5T160-342v102Zm320-240Z" />
  </svg>
)

export const TheaterIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

export const SetlistIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

export const SectionIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
    <path d="m80-160 240-320L80-800h520q19 0 36 8.5t28 23.5l216 288-216 288q-11 15-28 23.5t-36 8.5H80Zm160-80h360l180-240-180-240H240l180 240-180 240Zm270-240Z" />
  </svg>
)

export const MenuIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="14" height="2" />
    <rect x="1" y="7" width="14" height="2" />
    <rect x="1" y="12" width="14" height="2" />
  </svg>
)

export const AlbumIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <circle cx="12" cy="12" r="3" strokeWidth={2} />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)

export const MusicIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
    />
  </svg>
)

export const AppleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <ellipse cx="12" cy="14" rx="7" ry="7.5" />
    <path d="M12 7c0-2.2 1.4-3.8 3.6-4.4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M13.4 4.6c1.2-1 3-1.3 4.6-.7-1 1.8-2.9 2.8-4.7 2.6" />
  </svg>
)

export const PlayIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v13.72a1 1 0 001.53.85l10.78-6.86a1 1 0 000-1.7L9.53 4.29A1 1 0 008 5.14z" />
  </svg>
)

export const PauseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5a2 2 0 012-2h1a2 2 0 012 2v14a2 2 0 01-2 2H9a2 2 0 01-2-2V5zm7 0a2 2 0 012-2h1a2 2 0 012 2v14a2 2 0 01-2 2h-1a2 2 0 01-2-2V5z" />
  </svg>
)

export const MicrophoneIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 10v2a7 7 0 0 1-14 0v-2"
    />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

export const UserIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="9" strokeWidth={2} />
    <circle cx="12" cy="9" r="3" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 18a5 5 0 0110 0" />
  </svg>
)

export const SettingsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 -960 960 960" fill="currentColor">
    <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
  </svg>
)

export const MeatballIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="12" cy="19" r="1.9" />
  </svg>
)

export const UsersIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-1a4 4 0 00-4-4h-1m0 5H7m10 0v-1c0-2.21-1.79-4-4-4H7a4 4 0 00-4 4v1h4m10-10a3 3 0 11-6 0 3 3 0 016 0zM8 10a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
)

export const VenueIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
)

export const CalendarIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
)

export const TableIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="14" rx="1" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M9 10v9M15 10v9" />
  </svg>
)

export const GridIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
)

export const BarChartHorizontalIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h10M4 12h15M4 18h7" />
    <circle cx="16" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="21" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="11" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const ContainsIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <text
      x="50%"
      y="50%"
      dominantBaseline="central"
      textAnchor="middle"
      fontSize="28"
      fontFamily="serif"
      fontWeight="bold"
    >
      ⊆
    </text>
  </svg>
)

export const EqualsIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 8h14" />
  </svg>
)

export const StartsWithIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6v12" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l4 2-4 2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12h8" />
  </svg>
)

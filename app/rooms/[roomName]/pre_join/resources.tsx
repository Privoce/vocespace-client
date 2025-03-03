export type SvgType =
  | 'screen'
  | 'screen_close'
  | 'play'
  | 'audio'
  | 'audio_close'
  | 'video'
  | 'video_close'
  | 'user';

export function SvgResource({ type, svgSize = 24 }: { type: SvgType; svgSize?: number }) {
  switch (type) {
    case 'screen':
      return (
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="18899"
          width={svgSize}
          height={svgSize}
        >
          <path
            d="M131.32 158.17h-1.03c-12.16 0-22.35 8.67-24.71 20.15l-0.51 5.07V685.9c0 12.16 8.67 22.36 20.15 24.71l5.07 0.51h772.93c12.16 0 22.35-8.67 24.71-20.15l0.51-5.08V182.88c0-12.16-8.67-22.36-20.15-24.37l-5.08-0.34-771.9-0.51m12.85-87.53l792.94 0.51c45.55 0 82.89 34.66 86.69 79.09l0.31 8.44v552.96c0 38.8-22.14 82.51-71.78 86.74l0.3 0.27H87.11c-45.06 0-82.37-34.66-86.61-78.66l-0.4-8.35V157.65c0-30.89 44.66-87.01 97.91-87.01m599.71 787.43c26.41 0 48.02 21.61 48.02 48.03 0 26.41-21.61 48.03-48.02 48.03H369.54c-26.41 0-48.02-21.61-48.02-48.03 0-26.41 21.61-48.03 48.02-48.03h328.18z"
            fill="#ffffff"
            p-id="18900"
          ></path>
        </svg>
      );
    case 'screen_close':
      return (
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="19233"
          width={svgSize}
          height={svgSize}
        >
          <path
            d="M50.6 115.71l80.72 87.52h-1.03c-13.9 0-25.23 11.33-25.23 25.23v502.47c0 13.9 11.33 25.23 25.23 25.23h470.12l80.04 87.01H87.11C39.23 843.17 0.1 804.04 0.1 756.16V202.71c0-30.89 21.42-87 50.5-87z m886.48 0c48.39 0 87.52 39.13 87.01 87.52v552.92c0 41.7-25.58 89.06-83.37 87.01l-79.21-87.01h41.7c13.9 0 25.23-11.33 25.23-25.23V227.94c0-13.9-11.33-25.23-25.23-24.71H386.87l-81.33-87.52h631.54zM183.81 39.69l685.51 797.74c19.42 20.26 19.42 52.34 0 71.75-19.42 19.42-51.49 19.42-71.75 0L112.06 111.44c-19.42-19.42-19.42-51.49 0-71.75 19.41-19.42 51.49-19.42 71.75 0z m513.9 863.39c26.41 0 48.02 21.61 48.02 48.02 0 26.41-21.61 48.02-48.02 48.02H369.53c-26.41 0-48.02-21.61-48.02-48.02 0-26.41 21.61-48.02 48.02-48.02h328.18z"
            fill="#ffffff"
            p-id="19234"
          ></path>
        </svg>
      );
    case 'play':
      return (
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M20 24V17.0718L26 20.5359L32 24L26 27.4641L20 30.9282V24Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'audio':
      return (
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="3961"
          width={svgSize}
          height={svgSize}
        >
          <path
            d="M815.2064 384C838.6048 384 857.6 403.0976 857.6 426.6624V512c0 174.0672-129.472 317.696-296.7936 338.688l-0.0128 87.9744h127.2064a42.5216 42.5216 0 0 1 42.3296 40.256l0.064 2.4192c0 23.552-18.9824 42.6624-42.3936 42.6624h-339.2c-23.424 0-42.4064-19.0976-42.4064-42.6624 0-23.5648 18.9952-42.6752 42.4064-42.6752h127.1936V850.688c-165.504-20.7616-293.9904-161.536-296.7424-333.0432L179.2 512v-85.3376C179.2 403.1104 198.1824 384 221.6064 384c23.4112 0 42.3936 19.0976 42.3936 42.6624V512c0 141.3888 113.8944 256 254.4 256s254.4-114.6112 254.4-256v-85.3376c0-23.552 18.9824-42.6624 42.4064-42.6624zM518.4 0c93.6704 0 169.6 76.416 169.6 170.6624V512c0 94.2592-75.9296 170.6624-169.6 170.6624S348.8 606.2464 348.8 512V170.6624C348.8 76.416 424.7296 0 518.4 0z m0 85.3376c-46.8352 0-84.8 38.1952-84.8 85.3248V512c0 47.1296 37.9648 85.3376 84.8 85.3376s84.8-38.208 84.8-85.3376V170.6624c0-47.1296-37.9648-85.3248-84.8-85.3248z"
            fill="#ffffff"
            p-id="3962"
          ></path>
        </svg>
      );
    case 'audio_close':
      return (
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="3799"
          width={svgSize}
          height={svgSize}
        >
          <path
            d="M362.6624 1024c-21.504 0-38.9248-19.0976-38.9248-42.6624 0-23.552 17.4208-42.6624 38.9248-42.6624h116.8v-85.7984a289.3696 289.3696 0 0 1-74.944-20.9664l-4.9024-2.1632c-115.7632-52.3264-191.5136-175.4368-192.6784-311.9872v-91.008c0-23.5648 17.4208-42.6624 38.9248-42.6624s38.9376 19.0976 38.9376 42.6624v85.632c-0.704 104.3456 56.4864 198.7072 144.512 238.4896a216.2304 216.2304 0 0 0 77.6448 19.0464 35.8016 35.8016 0 0 1 22.8608-0.0256c44.608-2.3808 88.1664-18.7776 125.0816-47.9104l-57.472-62.976c-41.472 26.752-92.7616 31.4112-138.6112 10.6112-58.1504-26.3808-96.0896-88.5376-96.1536-157.5552v-110.3104L62.6048 72.96C47.9872 56.96 47.424 31.36 60.9152 14.592l1.6896-1.9584c15.2064-16.6656 39.8592-16.6656 55.0528 0L732.416 686.1952c2.816 1.7792 5.4784 3.968 7.9104 6.5664 2.624 2.816 4.8128 5.952 6.5536 9.28l227.328 249.1264c15.2064 16.6656 15.2064 43.6736 0 60.3392-15.2064 16.6528-39.8592 16.6528-55.0528 0l-208.64-228.608c-44.864 38.5536-97.9584 62.336-153.1648 69.9648l-0.0128 85.8112h116.8128c20.7616 0 37.7216 17.8048 38.8736 40.2432l0.0512 2.432c0 23.552-17.4208 42.6496-38.9248 42.6496H362.6624z m428.2752-639.9104c21.504 0 38.9248 19.0976 38.9248 42.6624v85.3504a373.1072 373.1072 0 0 1-4.8896 59.968c-3.8016 23.1936-24.0384 38.6176-45.1968 34.4576-21.1584-4.16-35.2384-26.3296-31.4496-49.5232 2.432-14.848 3.6608-29.888 3.6736-44.928V426.752c0-23.5648 17.4336-42.6624 38.9376-42.6624z m-350.4128 102.9888v24.96c0.0384 34.4832 19.008 65.5616 48.0896 78.7456a71.4752 71.4752 0 0 0 49.856 3.6096l-97.9456-107.3152z m-74.752-350.3872C381.7216 50.7776 454.464-7.936 534.0672 0.896c79.6032 8.8064 140.16 82.2784 140.0832 169.8944V398.592c0 23.552-17.4336 42.6624-38.9376 42.6624-21.504 0-38.9376-19.0976-38.9376-42.6624V170.7392c0.0384-43.84-30.2336-80.576-70.0416-84.9792-38.848-4.3008-74.432 23.5776-83.5072 64.8704l-0.6272 3.0464c-4.2752 23.0912-24.832 38.016-45.9008 33.3184-21.0688-4.6848-34.688-27.2128-30.4-50.304z"
            fill="#ffffff"
            p-id="3800"
          ></path>
        </svg>
      );
    case 'video':
      return (
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="3163"
          width={svgSize}
          height={svgSize}
        >
          <path
            d="M597.3376 179.2c70.6944 0 128 56.96 128 127.2064l-0.0128 129.6 231.2064-164.1088c28.2368-20.0448 67.4688 0.0128 67.4688 34.496v424.0128c0 34.4832-39.232 54.5408-67.456 34.496L725.312 600.7808v129.6256c0 70.2464-57.2928 127.1936-128 127.1936H128c-70.6944 0-128-56.96-128-127.2064V306.4064C0 236.1344 57.3056 179.2 128 179.2h469.3376z m0 84.8H128c-23.552 0-42.6624 18.9824-42.6624 42.4064v423.9872c0 23.424 19.0976 42.4064 42.6624 42.4064h469.3376c23.552 0 42.6624-18.9824 42.6624-42.4064V306.4064c0-23.424-19.0976-42.4064-42.6624-42.4064z m341.3248 124.8L756.0704 518.4l182.592 129.6128V388.7872z"
            fill="#ffffff"
            p-id="3164"
          ></path>
        </svg>
      );
    case 'video_close':
      return (
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="3481"
          width={svgSize}
          height={svgSize}
        >
          <path
            d="M12.49819 12.49819a42.662011 42.662011 0 0 1 60.338649 0L1011.503474 951.164825a42.662011 42.662011 0 0 1-60.338649 60.338649l-236.029847-236.029846a128.037232 128.037232 0 0 1-117.797325 77.861689H128.004336c-70.693755 0-127.998832-57.305077-127.998832-127.998832V298.665179c0-65.061806 48.549957-118.782916 111.397383-126.923642L12.49819 72.836839a42.662011 42.662011 0 0 1 0-60.338649zM195.664519 256.003168H128.004336a42.662011 42.662011 0 0 0-42.662011 42.662011v426.671306A42.662011 42.662011 0 0 0 128.004336 767.998496h469.333317A42.662011 42.662011 0 0 0 639.999664 725.336485v-24.998172L195.664519 256.003168z m401.660334-85.336821c70.706555 0 127.998832 57.305077 127.998832 127.998832v124.837261l4.46716 4.454359 226.532333-163.864105C984.53412 243.68968 1023.99616 263.849496 1023.99616 298.665179v426.671306a42.662011 42.662011 0 0 1-85.336821 0V382.184417L750.334657 518.413573a42.662011 42.662011 0 0 1-55.167496-4.403159l-42.674811-42.662011A42.662011 42.662011 0 0 1 639.999664 441.179078V298.665179A42.662011 42.662011 0 0 0 597.337653 256.003168H454.823754a42.662011 42.662011 0 0 1 0-85.336821h142.513899z"
            fill="#ffffff"
            p-id="3482"
          ></path>
        </svg>
      );
    case 'user':
      return (
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.00372 42.2311C5.00372 42.6557 5.35807 42.9999 5.79521 42.9999L42.2023 43C42.6394 43 42.9938 42.6558 42.9938 42.2313V41.3131C43.012 41.0364 43.049 39.6555 42.1388 38.1289C41.5648 37.1663 40.7318 36.3347 39.6628 35.6573C38.3696 34.8378 36.7245 34.244 34.7347 33.8865C34.72 33.8846 33.2446 33.689 31.7331 33.303C29.101 32.6307 28.8709 32.0357 28.8694 32.0299C28.8539 31.9711 28.8315 31.9146 28.8028 31.8615C28.7813 31.7505 28.7281 31.3328 28.8298 30.2136C29.088 27.371 30.6128 25.691 31.838 24.3412C32.2244 23.9155 32.5893 23.5134 32.8704 23.1191C34.0827 21.4181 34.1952 19.4839 34.2003 19.364C34.2003 19.1211 34.1724 18.9214 34.1127 18.7363C33.9937 18.3659 33.7698 18.1351 33.6063 17.9666L33.6052 17.9654C33.564 17.923 33.5251 17.8828 33.4933 17.8459C33.4812 17.8318 33.449 17.7945 33.4783 17.603C33.5859 16.8981 33.6505 16.3079 33.6815 15.7456C33.7367 14.7438 33.7798 13.2456 33.5214 11.7875C33.4895 11.5385 33.4347 11.2755 33.3494 10.9622C33.0764 9.95814 32.6378 9.09971 32.0284 8.39124C31.9236 8.27722 29.3756 5.5928 21.9788 5.04201C20.956 4.96586 19.9449 5.00688 18.9496 5.05775C18.7097 5.06961 18.3812 5.08589 18.0738 5.16554C17.3101 5.36337 17.1063 5.84743 17.0528 6.11834C16.9641 6.56708 17.12 6.91615 17.2231 7.14718L17.2231 7.1472L17.2231 7.14723C17.2381 7.18072 17.2566 7.22213 17.2243 7.32997C17.0526 7.59588 16.7825 7.83561 16.5071 8.06273C16.4275 8.13038 14.5727 9.72968 14.4707 11.8189C14.1957 13.4078 14.2165 15.8834 14.5417 17.5944C14.5606 17.6889 14.5885 17.8288 14.5432 17.9233L14.5432 17.9233C14.1935 18.2367 13.7971 18.5919 13.7981 19.4024C13.8023 19.4839 13.9148 21.4181 15.1272 23.1191C15.408 23.5131 15.7726 23.9149 16.1587 24.3403L16.1596 24.3412L16.1596 24.3413C17.3848 25.6911 18.9095 27.371 19.1678 30.2135C19.2694 31.3327 19.2162 31.7505 19.1947 31.8614C19.166 31.9145 19.1436 31.971 19.1282 32.0298C19.1266 32.0356 18.8974 32.6287 16.2772 33.2996C14.7656 33.6867 13.2775 33.8845 13.2331 33.8909C11.2994 34.2173 9.66438 34.7963 8.37351 35.6115C7.30813 36.2844 6.47354 37.1175 5.89289 38.0877C4.96517 39.6379 4.99025 41.0497 5.00372 41.3074V42.2311Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

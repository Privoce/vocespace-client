export function SvgPreJoin({ type }: { type: 'audio' | 'video' | 'user' | 'play' | 'screen' }) {
  switch (type) {
    case 'screen':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 9H11C9.34315 9 8 10.3431 8 12V33H40V22"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 33H44V35C44 38.3137 41.3137 41 38 41H10C6.68629 41 4 38.3137 4 35V33Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M33 7L29 11L33 15"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M39 7L43 11L39 15"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'play':
      return (
        <svg
          width="24"
          height="24"
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
          width="24"
          height="24"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="16"
            y="4"
            width="16"
            height="28"
            rx="8"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 21V24C10 31.732 16.268 38 24 38V38C31.732 38 38 31.732 38 24V21"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M24 5V11"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 16H21"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27 16H32"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 22H21"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27 22H32"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M24 38V44" stroke="#ffffff" strokeWidth="4" />
          <path
            d="M16 44H32"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'video':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 10C4 8.89543 4.89543 8 6 8H34C35.1046 8 36 8.89543 36 10V19L44 13V36L36 30V38C36 39.1046 35.1046 40 34 40H6C4.89543 40 4 39.1046 4 38V10Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 16V20"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15 14V22"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 16V20"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'user':
      return (
        <svg
          width="24"
          height="24"
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

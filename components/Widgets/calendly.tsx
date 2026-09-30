'use client';

import { SvgResource } from '@/components/Icon/index';
import { useEffect } from 'react';
import styles from '@/components/Controller/index.module.scss';

export function Calendly() {
  useEffect(() => {
    let scriptSrc = 'https://assets.calendly.com/assets/external/widget.js';
    let script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      const calendlyWidget = document.querySelector('.calendly-inline-widget');
      if (calendlyWidget) {
        calendlyWidget.setAttribute('data-url', 'https://calendly.com/hansu/han-meeting?back=1');
      }
    };
    document.body.appendChild(script);
    return () => {
      const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);



  return (
    <>
      <div className={styles.calendly_header}>
        <div className={styles.calendly_header_item}>
          <SvgResource type="email" svgSize={16} color="#888"></SvgResource>
          <span>Email: han@privoce.com</span>
        </div>
        <div className={styles.calendly_header_item}>
          <SvgResource type="wechat" svgSize={16} color="#888"></SvgResource>
          <span>WeChat: Privoce</span>
        </div>
      </div>
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <div id="calendar" className="w-full h-[700px] bg-white rounded_box">
          <div
            className="calendly-inline-widget"
            data-url="https://calendly.com/hansu/han-meeting?back=1"
            style={{ minWidth: '320px', height: '700px' }}
          ></div>
        </div>
      </div>
    </>
  );
}

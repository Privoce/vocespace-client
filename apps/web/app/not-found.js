"use client";

import React from 'react';

const Custom404 = () => {

  const backHome = () => {
    window.location.href = '/';
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
      }}
    >
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          alignContent: 'center',
          width: '48vw',
          gap: '24px',
          textAlign: 'left',
        }}
      >
        <h1
          style={{
            fontSize: '48px',
            width: '100%',
            fontWeight: '900',
            margin: '0',
            padding: '0',
          }}
        >
          404 | Page Not Found
        </h1>
        <div
          style={{
            width: '100%',
          }}
        >
          <p
            style={{
              width: '100%',
            }}
          >
            We could not find what you were looking for.
          </p>
          <p>
            Please contact the owner of the site that linked you to the original URL and let them
            know their link is broken.
          </p>
        </div>
        <button
          style={{
            width: 'fit-content',
            padding: '8px 16px',
            backgroundColor: '#22CCEE',
            color: 'white',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={backHome}
        >
          Back
        </button>
      </div>
    </div>
  );
};

Custom404.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Custom404;

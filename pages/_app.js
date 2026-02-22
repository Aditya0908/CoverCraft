import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
    return (
        <>
            <Component {...pageProps} />
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: '#1a1a2e',
                        color: '#f1f0ff',
                        border: '1px solid rgba(124,92,252,0.3)',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                    },
                    success: { iconTheme: { primary: '#34d399', secondary: '#050508' } },
                    error: { iconTheme: { primary: '#f87171', secondary: '#050508' } },
                }}
            />
        </>
    );
}

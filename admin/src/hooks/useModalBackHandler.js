import { useCallback, useEffect, useRef } from 'react';

/**
 * Adds browser history entry while modal is open, so mobile hardware back
 * closes the modal first instead of navigating away.
 */
const useModalBackHandler = (isOpen, onClose) => {
    const stateRef = useRef({ pushed: false, isOpen: false });
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        // Track close transitions and clear push flag.
        if (!isOpen && stateRef.current.isOpen) {
            stateRef.current.isOpen = false;
            stateRef.current.pushed = false;
            return undefined;
        }
        if (!isOpen) return undefined;

        // Prevent duplicate history entries while modal remains open.
        if (stateRef.current.isOpen) return undefined;
        stateRef.current.isOpen = true;

        window.history.pushState({ modalOpen: true }, '');
        stateRef.current.pushed = true;

        const onPopState = () => {
            stateRef.current.pushed = false;
            stateRef.current.isOpen = false;
            onCloseRef.current?.();
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [isOpen]);

    return useCallback(() => {
        if (stateRef.current.isOpen && stateRef.current.pushed) {
            stateRef.current.pushed = false;
            stateRef.current.isOpen = false;
            window.history.back();
            return;
        }
        onCloseRef.current?.();
    }, []);
};

export default useModalBackHandler;

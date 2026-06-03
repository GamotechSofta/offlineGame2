import React from 'react';
import Layout from '../components/Layout';
import BookiePaymentsScreen from '../components/BookiePaymentsScreen';
import { useLanguage } from '../context/LanguageContext';

const Payments = () => {
    const { t } = useLanguage();
    return (
        <Layout title={t('payments')}>
            <BookiePaymentsScreen />
        </Layout>
    );
};

export default Payments;

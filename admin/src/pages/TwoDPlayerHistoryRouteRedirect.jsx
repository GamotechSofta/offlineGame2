import { Navigate, useParams } from 'react-router-dom';

/** Old bookmark URLs → list + open history modal. */
const TwoDPlayerHistoryRouteRedirect = () => {
    const { userId } = useParams();
    return (
        <Navigate
            to="/2d-management/current-slot-players"
            replace
            state={{ openHistoryUserId: userId }}
        />
    );
};

export default TwoDPlayerHistoryRouteRedirect;

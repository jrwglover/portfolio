import { useParams, Navigate } from 'react-router-dom';
import { getLeafBySlug } from '../config/topics';
import BondDashboard from './dashboards/bondbootstrapper/BondDashboard';
import CurveModelDashboard from './dashboards/curve_model/CurveModelDashboard';
import BridgeDashboard from './dashboards/spark_bridge/BridgeDashboard';

const COMPONENTS: Record<string, React.ComponentType<any>> = {
  BondDashboard,
  CurveModelDashboard,
  BridgeDashboard,
};

export default function TopicDashboard() {
  const { slug } = useParams();
  const leaf = getLeafBySlug(slug ?? '');

  if (!leaf) return <Navigate to="/" replace />;

  const Comp = COMPONENTS[leaf.dashboard.component];
  if (!Comp) return <Navigate to="/" replace />;

  return <Comp defaultTab={leaf.dashboard.defaultTab} breadcrumb={leaf.breadcrumb} />;
}

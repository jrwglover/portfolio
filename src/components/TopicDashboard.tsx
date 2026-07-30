import { useParams, Navigate } from 'react-router-dom';
import { getLeafBySlug } from '../config/topics';
import CurveDashboard from './dashboards/mc_interp_cuda/CurveDashboard';
import BondDashboard from './dashboards/bondbootstrapper/BondDashboard';
import VegaDashboard from './dashboards/parameter_reduction/VegaDashboard';
import CurveModelDashboard from './dashboards/curve_model/CurveModelDashboard';
import BridgeDashboard from './dashboards/spark_bridge/BridgeDashboard';

const COMPONENTS: Record<string, React.ComponentType<any>> = {
  CurveDashboard,
  BondDashboard,
  VegaDashboard,
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

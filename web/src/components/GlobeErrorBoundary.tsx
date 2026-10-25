import {Component, ReactNode} from 'react';
import {Globe2} from 'lucide-react';

type Props = {children: ReactNode; onBack: () => void};
type State = {error: string | null};

/** Keeps a Three.js failure from blanking the whole Nearby page. */
export class GlobeErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error) {
    return {error: error.message || 'ไม่สามารถเปิดมุมมองโลกได้'};
  }

  render() {
    if (this.state.error) {
      return (
        <div className="globe-shell map-tall globe-fallback">
          <Globe2 size={36} />
          <b>เปิดมุมมองโลกไม่สำเร็จ</b>
          <p className="muted small">{this.state.error}</p>
          <button type="button" className="btn btn-mint" onClick={this.props.onBack}>
            กลับแผนที่ใกล้ๆ
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

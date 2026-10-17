import bee from '../../assets/beebobble.webp';
import styles from './BeeBobble.module.css';

export default function BeeBobble() {
  return <img className={styles.bee} src={bee} width={112} height={112} alt="" aria-hidden="true" draggable={false} />;
}

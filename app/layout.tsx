import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
export const metadata:Metadata={title:'Конкуренты рядом — исследуйте район',description:'Найдите похожие предприятия рядом с будущим бизнесом по открытым данным OpenStreetMap.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}

import React, { useEffect, useState } from 'react';
import { MOCK_NEWS } from '../constants';
import { ExternalLink, Newspaper, AlertCircle } from 'lucide-react';

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: number;
  tags?: string;
}

export const NewsPanel: React.FC = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // Using CryptoCompare Public News API
        const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        
        if (!res.ok) {
          throw new Error(`Status: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.Data && Array.isArray(data.Data)) {
          const formatted = data.Data.slice(0, 10).map((item: any) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            source: item.source,
            published_at: item.published_on * 1000,
            tags: item.tags
          }));
          setNews(formatted);
          setIsUsingMock(false);
        } else {
          throw new Error('No data structure match');
        }
      } catch (e) {
        // Quietly fallback to mock data on network/CORS error
        console.warn("News feed unavailable (likely CORS or ad-block), switching to demo data.");
        
        setNews(MOCK_NEWS.map(n => ({
            id: n.id,
            title: n.title,
            url: n.url,
            source: n.source,
            published_at: new Date(n.published_at).getTime(),
            tags: n.sentiment
        })));
        setIsUsingMock(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 60000); // 1 min update
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (tags: string | undefined) => {
    if (!tags) return 'bg-gray-600/20 text-gray-400';
    const t = tags.toLowerCase();
    if (t.includes('bull') || t.includes('adoption') || t.includes('positive') || t.includes('buy')) return 'bg-green-500/20 text-green-400';
    if (t.includes('bear') || t.includes('ban') || t.includes('hack') || t.includes('negative') || t.includes('sell')) return 'bg-red-500/20 text-red-400';
    return 'bg-blue-500/20 text-blue-400';
  };

  return (
    <div className="bg-[#111827] rounded-lg border border-gray-800 p-4 h-[400px] flex flex-col">
      <h3 className="text-gray-200 font-semibold mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
            <Newspaper size={18} className="text-blue-500"/>
            Market News
        </span>
        <span className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${isUsingMock ? 'bg-yellow-900/20 border-yellow-800 text-yellow-500' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            {loading ? 'Updating...' : isUsingMock ? (
              <>
               <AlertCircle size={10} />
               Demo Data
              </>
            ) : 'Live Feed'}
        </span>
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-700">
        {news.map((item) => (
          <div key={item.id} className="p-3 bg-gray-900/30 rounded-lg border border-gray-800 hover:border-gray-600 transition-all group">
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getSentimentColor(item.tags)}`}>
                {item.source}
              </span>
              <span className="text-[10px] text-gray-500">{new Date(item.published_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <h4 className="text-sm font-medium text-gray-200 leading-snug mb-2 group-hover:text-blue-400 transition-colors">
                <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            </h4>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50">
              <span className="text-[10px] text-gray-600 truncate max-w-[200px]">{item.tags?.split('|').join(', ')}</span>
              <a href={item.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-white transition-colors">
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import LoadingScreen from '../components/LoadingScreen';
import api from '../api/axios';

const FeedPage = () => {
  const [posts, setPosts] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const { user } = useAuth();

  // Auto-close story after 5 seconds
  useEffect(() => {
    if (selectedStory && selectedStory.stories && selectedStory.stories.length > 0) {
      const timer = setTimeout(() => {
        if (currentStoryIndex < selectedStory.stories.length - 1) {
          setCurrentStoryIndex(currentStoryIndex + 1);
        } else {
          setSelectedStory(null);
          setCurrentStoryIndex(0);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [selectedStory, currentStoryIndex]);

  useEffect(() => { 
    fetchPosts(); 
    fetchSuggested();
    fetchStories();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts');
      setPosts(res.data);
    } catch (err) { /* ignore */ }
    setLoading(false);
  };

  const fetchSuggested = async () => {
    try {
      const res = await api.get('/users/suggested');
      setSuggested(res.data);
    } catch (err) { /* ignore */ }
  };

  const fetchStories = async () => {
    try {
      const res = await api.get('/stories');
      setStories(res.data);
    } catch (err) { /* ignore */ }
  };

  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(p => 
        p._id === postId 
          ? { ...p, likes: res.data.isLiked ? [...p.likes, user._id] : p.likes.filter(id => id !== user._id) } 
          : p
      ));
    } catch (err) { /* ignore */ }
  };

  const handleFollow = async (userId) => {
    try {
      await api.post(`/users/${userId}/follow`);
      setSuggested(suggested.filter(u => u._id !== userId));
    } catch (err) { /* ignore */ }
  };

  const viewStory = async (storyGroup) => {
    setSelectedStory(storyGroup);
    setCurrentStoryIndex(0);
    // Mark stories as viewed
    for (const story of storyGroup.stories) {
      try {
        await api.post(`/stories/${story._id}/view`);
      } catch (err) { /* ignore */ }
    }
  };

  const closeStory = () => {
    setSelectedStory(null);
    setCurrentStoryIndex(0);
  };

  if (loading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      {/* Story Viewer Modal */}
      {selectedStory && selectedStory.stories && selectedStory.stories.length > 0 && (
        <div 
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={closeStory}
        >
          {/* Progress bars */}
          <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
            {selectedStory.stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-white rounded-full ${idx === currentStoryIndex ? '' : idx < currentStoryIndex ? 'w-full' : 'w-0'}`}
                  style={idx === currentStoryIndex ? { animation: 'progressBar 5s linear forwards' } : {}}
                ></div>
              </div>
            ))}
          </div>
          
          {/* Close button */}
          <button 
            onClick={(e) => { e.stopPropagation(); closeStory(); }}
            className="absolute top-8 right-4 text-white text-2xl z-20 w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
          
          {/* User info */}
          <div className="absolute top-8 left-4 flex items-center gap-3 z-20">
            <img src={selectedStory.user?.avatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white" />
            <div>
              <span className="text-white font-semibold">{selectedStory.user?.username}</span>
              <p className="text-white/70 text-xs">
                {selectedStory.stories[currentStoryIndex]?.createdAt && new Date(selectedStory.stories[currentStoryIndex].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          
          {/* Navigation arrows */}
          {currentStoryIndex > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentStoryIndex(currentStoryIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl z-20 w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
          )}
          {currentStoryIndex < selectedStory.stories.length - 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentStoryIndex(currentStoryIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl z-20 w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          )}
          
          {/* Story image */}
          <img 
            src={selectedStory.stories[currentStoryIndex]?.image} 
            alt="" 
            className="max-h-screen max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Caption */}
          {selectedStory.stories[currentStoryIndex]?.caption && (
            <div className="absolute bottom-10 left-0 right-0 text-center text-white px-4 z-20">
              <p className="bg-black/50 inline-block px-4 py-2 rounded-lg">{selectedStory.stories[currentStoryIndex].caption}</p>
            </div>
          )}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Stories Section */}
        {stories.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm overflow-hidden">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {stories.map((storyGroup) => (
                <div 
                  key={storyGroup.user._id} 
                  className="flex-shrink-0 cursor-pointer"
                  onClick={() => viewStory(storyGroup)}
                >
                  {storyGroup.stories && storyGroup.stories.length > 0 ? (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 p-0.5 mb-1">
                      <img 
                        src={storyGroup.user.avatar} 
                        alt="" 
                        className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-800" 
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full mb-1">
                      <img 
                        src={storyGroup.user.avatar} 
                        alt="" 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    </div>
                  )}
                  <p className="text-xs text-center dark:text-slate-300 truncate w-16">{storyGroup.user.username}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-8">
          <div className="flex-1 max-w-lg mx-auto lg:mx-0">
            {posts.length === 0 ? (
              <div className="card p-8 text-center dark:bg-slate-800">
                <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <i className="fas fa-camera text-4xl text-slate-400"></i>
                </div>
                <h3 className="text-xl font-semibold text-slate-700 dark:text-white mb-2">No posts yet</h3>
                <p className="text-slate-500 dark:text-slate-400">Follow some creators to see their posts!</p>
              </div>
            ) : (
              posts.map(post => <PostCard key={post._id} post={post} onLike={handleLike} onDelete={(postId) => setPosts(posts.filter(p => p._id !== postId))} />)
            )}
          </div>

          <div className="hidden lg:block w-80">
            <div className="card p-4 mb-4 dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <img src={user?.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
                <div>
                  <p className="font-semibold dark:text-white">{user?.username}</p>
                  <p className={`text-sm px-2 py-0.5 rounded-full inline-block ${user?.role === 'creator' ? 'badge-creator' : 'badge-consumer'}`}>
                    {user?.role}
                  </p>
                </div>
              </div>
            </div>

            {suggested.length > 0 && (
              <div className="card p-4 dark:bg-slate-800">
                <h4 className="font-semibold text-slate-500 dark:text-slate-400 text-sm mb-4">Suggested Creators</h4>
                {suggested.map(u => (
                  <div key={u._id} className="flex items-center justify-between mb-4 last:mb-0">
                    <Link to={`/profile/${u._id}`} className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-transparent" />
                      <div>
                        <p className="font-semibold text-sm dark:text-white">{u.username}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">{u.followers?.length || 0} followers</p>
                      </div>
                    </Link>
                    <button onClick={() => handleFollow(u._id)} className="text-red-500 text-sm font-semibold hover:text-red-600">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FeedPage;

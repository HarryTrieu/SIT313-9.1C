import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from './firebase';
import QuestionCard from './QuestionCard';
import FilterControls from './FilterControls';

const FindQuestionPage = () => {
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [filters, setFilters] = useState({
    searchTerm: '',
    selectedTag: '',
    dateFilter: 'all'
  });

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('type', '==', 'question'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const questionsData = [];
      querySnapshot.forEach((doc) => {
        questionsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setQuestions(questionsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching questions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = [...questions];

    if (filters.searchTerm) {
      filtered = filtered.filter(question =>
        question.title.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    if (filters.selectedTag) {
      filtered = filtered.filter(question =>
        question.tags && question.tags.some(tag => 
          tag.toLowerCase().includes(filters.selectedTag.toLowerCase())
        )
      );
    }

    if (filters.dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filters.dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }

      filtered = filtered.filter(question => {
        if (question.createdAt && question.createdAt.toDate) {
          return question.createdAt.toDate() >= filterDate;
        }
        return true;
      });
    }

    setFilteredQuestions(filtered);
  }, [questions, filters]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleDeleteQuestion = async (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteDoc(doc(db, 'posts', questionId));
      } catch (error) {
        alert('Error deleting question. Please try again.');
      }
    }
  };

  const handleCardClick = (questionId) => {
    setExpandedCard(expandedCard === questionId ? null : questionId);
  };

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <h2 className="mb-4">Find Questions</h2>
          
          <FilterControls 
            filters={filters}
            onFilterChange={handleFilterChange}
            questions={questions}
          />

          <div className="mt-4">
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-5">
                <h5 className="text-muted">No questions found</h5>
                <p className="text-muted">
                  {questions.length === 0 
                    ? 'No questions have been posted yet.' 
                    : 'Try adjusting your filters to see more results.'
                  }
                </p>
              </div>
            ) : (
              <div className="row">
                {filteredQuestions.map((question) => (
                  <div key={question.id} className="col-12 mb-3">
                    <QuestionCard
                      question={question}
                      isExpanded={expandedCard === question.id}
                      onCardClick={() => handleCardClick(question.id)}
                      onDelete={() => handleDeleteQuestion(question.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindQuestionPage;
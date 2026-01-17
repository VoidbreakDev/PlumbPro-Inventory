import React, { useState } from 'react';
import { X, Star, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supplierRatingsAPI } from '../lib/supplierAPI';

interface SupplierRatingModalProps {
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SupplierRatingModal: React.FC<SupplierRatingModalProps> = ({
  supplierId,
  supplierName,
  onClose,
  onSuccess
}) => {
  const [ratings, setRatings] = useState({
    overall: 0,
    quality: 0,
    delivery: 0,
    communication: 0,
    pricing: 0
  });
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratingCategories = [
    { key: 'overall' as const, label: 'Overall Experience', required: true },
    { key: 'quality' as const, label: 'Product Quality', required: true },
    { key: 'delivery' as const, label: 'Delivery Performance', required: true },
    { key: 'communication' as const, label: 'Communication', required: true },
    { key: 'pricing' as const, label: 'Pricing & Value', required: true }
  ];

  const handleStarClick = (category: keyof typeof ratings, value: number) => {
    setRatings(prev => ({ ...prev, [category]: value }));
  };

  const renderStars = (category: keyof typeof ratings) => {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleStarClick(category, star)}
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-transform hover:scale-110"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                star <= ratings[category]
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300 hover:text-yellow-200'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const canSubmit = () => {
    return ratingCategories.every(cat => ratings[cat.key] > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit()) {
      setError('Please rate all categories');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await supplierRatingsAPI.create(supplierId, {
        overallRating: ratings.overall,
        qualityRating: ratings.quality,
        deliveryRating: ratings.delivery,
        communicationRating: ratings.communication,
        pricingRating: ratings.pricing,
        reviewTitle: reviewTitle.trim() || undefined,
        reviewText: reviewText.trim() || undefined,
        wouldRecommend
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit rating');
      console.error('Submit rating error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Rate Supplier</h2>
            <p className="text-sm text-gray-600 mt-1">{supplierName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Rating Categories */}
            <div className="space-y-5">
              {ratingCategories.map((category) => (
                <div key={category.key} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {category.label}
                    {category.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderStars(category.key)}
                </div>
              ))}
            </div>

            {/* Would Recommend */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Would you recommend this supplier?
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWouldRecommend(true)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    wouldRecommend
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="font-medium">Yes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWouldRecommend(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    !wouldRecommend
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <ThumbsDown className="w-5 h-5" />
                  <span className="font-medium">No</span>
                </button>
              </div>
            </div>

            {/* Review Title */}
            <div className="space-y-2">
              <label htmlFor="reviewTitle" className="block text-sm font-medium text-gray-700">
                Review Title <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                id="reviewTitle"
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="e.g., Excellent service and quality"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Review Text */}
            <div className="space-y-2">
              <label htmlFor="reviewText" className="block text-sm font-medium text-gray-700">
                Review <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="reviewText"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this supplier..."
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 text-right">
                {reviewText.length}/500 characters
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit() || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

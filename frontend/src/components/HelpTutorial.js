import React, { useState } from 'react';
import { HelpCircle, X, ChevronDown, ChevronUp, Lightbulb, BookOpen, Zap } from 'lucide-react';

const HelpTutorial = ({ title, sections }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (index) => {
    setExpandedSection(expandedSection === index ? null : index);
  };

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        data-testid="help-tutorial-btn"
        className="inline-flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="text-sm font-medium">Ajuda</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
              <div className="space-y-4">
                {sections.map((section, index) => (
                  <div 
                    key={index}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection(index)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {section.icon && (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.iconBg || 'bg-blue-100'}`}>
                            <section.icon className={`w-4 h-4 ${section.iconColor || 'text-blue-600'}`} />
                          </div>
                        )}
                        <span className="font-medium text-slate-900">{section.title}</span>
                      </div>
                      {expandedSection === index ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    
                    {expandedSection === index && (
                      <div className="px-4 py-4 border-t border-slate-100 bg-white">
                        <div className="text-sm text-slate-600 space-y-3">
                          {section.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tips Section */}
              <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900">Dica</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Esta ajuda está sempre disponível no botão "Ajuda" no canto superior direito da página.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpTutorial;

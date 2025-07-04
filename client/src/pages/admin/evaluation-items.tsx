import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Upload, Download, Save, X, Printer, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EvaluationItemManagement() {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newCategory, setNewCategory] = useState({
    categoryCode: "",
    categoryName: "",
    description: "",
  });
  const [newItem, setNewItem] = useState({
    categoryId: "",
    itemCode: "",
    itemName: "",
    description: "",
    maxScore: "",
    weight: "",
  });

  // 컬럼 설정 관리
  const [columnConfig, setColumnConfig] = useState([
    { id: 'section', title: '구분', type: 'section', visible: true, required: true, width: 'w-32' },
    { id: 'item', title: '세부 항목', type: 'text', visible: true, required: true, width: 'flex-1' },
    { id: 'type', title: '유형', type: 'select', visible: true, required: false, width: 'w-16', options: ['정량', '정성'] },
    { id: 'points', title: '배점', type: 'number', visible: true, required: true, width: 'w-16' },
    { id: 'score', title: '평가점수', type: 'number', visible: true, required: true, width: 'w-20' },
  ]);

  // 평가위원 및 평가대상 선택
  const [selectedEvaluator, setSelectedEvaluator] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [batchPrintMode, setBatchPrintMode] = useState(false);

  // 평가위원 정보 (수동 입력용)
  const [evaluator, setEvaluator] = useState({
    name: '평가위원명',
    position: '직책',
    department: '소속기관'
  });

  // 평가표 템플릿 상태
  const [currentTemplate, setCurrentTemplate] = useState({
    title: "제공기관 선정 심의회 평가표",
    totalScore: 100,
    sections: [
      {
        id: 'A',
        title: '기관수행능력',
        totalPoints: 35,
        items: [
          { id: 1, text: '통계SOS 사업 운영 체계화 2단 완료', type: '정성', points: 20, score: 0 },
          { id: 2, text: '심의 및 승인 목적 확인', type: '정량', points: 5, score: 0 },
          { id: 3, text: '기관 운영 기간', type: '정성', points: 5, score: 0 },
          { id: 4, text: '조직구성', type: '정량', points: 5, score: 0 }
        ]
      },
      {
        id: 'B',
        title: '인력운영',
        totalPoints: 20,
        items: [
          { id: 1, text: '사업 운영 총괄자 및 담당자의 전문성', type: '정성', points: 5, score: 0 },
          { id: 2, text: '통계SOS 사업 운영 체계화부 담당자', type: '정량', points: 5, score: 0 },
          { id: 3, text: 'SOS서비스 수행 인력의 확보', type: '정량', points: 10, score: 0 }
        ]
      }
    ]
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 데이터 쿼리들
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/admin/categories"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/admin/evaluation-items"],
  });

  // 평가위원 목록 가져오기
  const { data: evaluators = [] } = useQuery({
    queryKey: ["/api/admin/evaluators"],
  });

  // 후보자 목록 가져오기
  const { data: candidates = [] } = useQuery({
    queryKey: ["/api/admin/candidates"],
  });

  // 컬럼 설정 변경 시 기존 데이터 동기화
  useEffect(() => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          const updatedItem = { ...item };
          columnConfig.forEach(column => {
            if (!['section', 'item', 'type', 'points', 'score'].includes(column.id)) {
              if (!(column.id in updatedItem)) {
                updatedItem[column.id] = column.type === 'number' ? 0 : '';
              }
            }
          });
          return updatedItem;
        })
      }))
    }));
  }, [columnConfig]);

  // 템플릿 관련 함수들
  const calculateSectionScore = (section: any) => {
    return section.items.reduce((sum: number, item: any) => sum + (item.points || 0), 0);
  };

  const calculateSectionTotalPoints = (section: any) => {
    return section.items.reduce((sum: number, item: any) => sum + (item.points || 0), 0);
  };

  const calculateTotalPoints = () => {
    return currentTemplate.sections.reduce((sum, section) => sum + calculateSectionTotalPoints(section), 0);
  };

  const calculateTotalScore = () => {
    return currentTemplate.sections.reduce((sum, section) => sum + section.items.reduce((itemSum, item) => itemSum + (item.score || 0), 0), 0);
  };

  // 보이는 컬럼들만 필터링
  const visibleColumns = columnConfig.filter(col => col.visible);

  // 선택된 평가위원과 후보자 정보
  const selectedEvaluatorInfo = evaluators.find((e: any) => e.id === selectedEvaluator);
  const selectedCandidateInfo = candidates.find((c: any) => c.id === selectedCandidate);

  // 동적 제목 생성
  const getDynamicTitle = () => {
    if (selectedCandidateInfo) {
      return `${selectedCandidateInfo.name} 심사표`;
    }
    return currentTemplate.title;
  };

  // 알림 함수
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50`;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

  // 🎯 통합된 평가표 HTML 생성 함수 (일반/배치/개별 인쇄 모두 공통 사용)
  const generateEvaluationHTML = (evaluatorInfo, candidateInfo, templateData = currentTemplate) => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // 동적 컬럼 생성
    const visibleColumns = columnConfig.filter(col => col.visible && !['section', 'item'].includes(col.id));

    // 제목 및 카테고리 정보 결정
    const candidateTitle = candidateInfo ? `${candidateInfo.name} 심사표` : templateData.title;
    const categoryInfo = candidateInfo ? (candidateInfo.category || candidateInfo.department || '') : '';

    // 평가위원 정보 결정
    const positionText = evaluatorInfo.position ? ` (${evaluatorInfo.position})` : '';

    // 총 배점 계산
    const totalPoints = templateData.sections.reduce((sum, section) => 
      sum + section.items.reduce((itemSum, item) => itemSum + (item.points || 0), 0), 0
    );

    // 총 점수 계산
    const totalScore = templateData.sections.reduce((sum, section) => 
      sum + section.items.reduce((itemSum, item) => itemSum + (item.score || 0), 0), 0
    );

    return `
      <!-- 제목과 구분 정보 표 -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 2px solid #666;">
        <tr>
          <td colspan="2" style="border: 1px solid #666; padding: 8px; text-align: right; font-size: 12px;">
            <span>구분 : ${categoryInfo}</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="border: 1px solid #666; padding: 16px; text-align: center; font-size: 18px; font-weight: bold;">
            ${candidateTitle}
          </td>
        </tr>
      </table>

      <!-- 평가 항목 표 -->
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #666;">
        <thead>
          <tr>
            <th style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #e8e8e8; font-weight: bold; font-size: 13px;">구분 (${totalPoints}점)</th>
            <th style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #e8e8e8; font-weight: bold; font-size: 13px;">세부 항목</th>
            ${visibleColumns.map(column => `
              <th style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #e8e8e8; font-weight: bold; font-size: 13px;">
                ${column.title}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${templateData.sections.map(section => {
            return section.items.map((item, itemIndex) => {
              return `
                <tr>
                  ${itemIndex === 0 ? `
                    <td rowspan="${section.items.length}" style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold; vertical-align: top; font-size: 12px;">
                      ${section.id}. ${section.title}<br>
                      <span style="font-size: 10px; color: #666;">(${section.items.reduce((sum, sectionItem) => sum + (sectionItem.points || 0), 0)}점)</span>
                    </td>
                  ` : ''}
                  <td style="border: 1px solid #666; padding: 8px; font-size: 12px;">
                    ${itemIndex + 1}. ${item.text}
                  </td>
                  ${visibleColumns.map(column => `
                    <td style="border: 1px solid #666; padding: 8px; text-align: center; font-size: 12px; vertical-align: middle;" class="${column.id === 'type' ? 'type-cell' : column.id === 'points' ? 'points-cell' : column.id === 'score' ? 'score-cell' : 'custom-cell'}">
                      ${column.id === 'points' ? `${item[column.id] || 0}점` : 
                       column.id === 'score' ? `${item[column.id] || 0}점` :
                       column.id === 'type' ? (item[column.id] || '') :
                       (item[column.id] || '')}
                    </td>
                  `).join('')}
                </tr>
              `;
            }).join('');
          }).join('')}
          <!-- 합계 행 -->
          <tr style="background-color: #e8e8e8; font-weight: bold;">
            <td style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #e8e8e8; vertical-align: middle; font-size: 13px;">합계</td>
            <td style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #f5f5f5; vertical-align: middle;"></td>
            ${visibleColumns.map(column => `
              <td style="border: 1px solid #666; padding: 12px; text-align: center; background-color: #f5f5f5; font-size: 13px; vertical-align: middle;">
                ${column.id === 'points' ? `${totalPoints}점` : 
                  column.id === 'score' ? `${totalScore}점` : 
                  ''}
              </td>
            `).join('')}
          </tr>
        </tbody>
      </table>

      <div class="evaluation-date">
        평가일: ${today}
      </div>
      <div class="evaluator-info">
        평가위원 : ${evaluatorInfo.name}${positionText} (서명)
      </div>
    `;
  };

  // 🎯 통합 인쇄 스타일 (모든 인쇄 함수에서 공통 사용)
  const getPrintStyle = () => `
    <style>
      @media print {
        @page {
          margin: 0 !important;
          size: A4 !important;
        }

        body {
          font-family: "맑은 고딕", "Malgun Gothic", Arial, sans-serif !important;
          margin: 0 !important;
          padding: 0 !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        .evaluation-page {
          padding: 95px 50px 50px 50px !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          min-height: 100vh !important;
          box-sizing: border-box !important;
        }

        .evaluation-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }

        .title {
          text-align: center !important;
          font-size: 24px !important;
          font-weight: bold !important;
          margin-bottom: 15px !important;
          color: black !important;
        }

        .evaluator-info {
          text-align: right !important;
          font-size: 16px !important;
          font-weight: bold !important;
          margin-top: 20px !important;
          margin-bottom: 20px !important;
          padding: 0 10px;
          text-decoration: underline !important;
        }

        .evaluation-date {
          text-align: center !important;
          font-size: 16px !important;
          font-weight: bold !important;
          margin-top: 20px !important;
          margin-bottom: 20px !important;
        }

        table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin-bottom: 30px !important;
          font-size: 13px !important;
          border: 2px solid #666 !important;
        }

        th, td {
          border: 1px solid #666 !important;
          padding: 12px 10px !important;
          vertical-align: middle !important;
        }

        th {
          background-color: #e8e8e8 !important;
          text-align: center !important;
          font-weight: bold !important;
        }

        .evaluation-page table:nth-of-type(1),
        .evaluation-page table:nth-of-type(2) {
          border-left: none !important;
          border-right: none !important;
        }

        .evaluation-page table:nth-of-type(1) td:first-child,
        .evaluation-page table:nth-of-type(1) th:first-child,
        .evaluation-page table:nth-of-type(2) td:first-child,
        .evaluation-page table:nth-of-type(2) th:first-child {
          border-left: none !important;
        }

        .evaluation-page table:nth-of-type(1) td:last-child,
        .evaluation-page table:nth-of-type(1) th:last-child,
        .evaluation-page table:nth-of-type(2) td:last-child,
        .evaluation-page table:nth-of-type(2) th:last-child {
          border-right: none !important;
        }

        .type-cell,
        .points-cell,
        .score-cell,
        .custom-cell {
          text-align: center !important;
        }

        .section-cell {
          background-color: #f8f9fa !important;
          font-weight: bold !important;
          text-align: center !important;
          vertical-align: top !important;
        }

        .no-print {
          display: none !important;
        }

        input, select {
          border: none !important;
          background: transparent !important;
          font-size: inherit !important;
          text-align: center !important;
          width: 100% !important;
        }
      }
    </style>
  `;

  // 컬럼 설정 관리 함수들
  const updateColumnConfig = (columnId: string, field: string, value: any) => {
    setColumnConfig(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, [field]: value } : col
      )
    );
  };

  const addColumn = () => {
    const newColumn = {
      id: `custom_${Date.now()}`,
      title: '새 컬럼',
      type: 'text',
      visible: true,
      required: false,
      width: 'w-20'
    };

    // 배점(points) 앞에 새 컬럼 삽입
    setColumnConfig(prev => {
      const pointsIndex = prev.findIndex(col => col.id === 'points');
      if (pointsIndex === -1) {
        return [...prev, newColumn];
      }
      const newConfig = [...prev];
      newConfig.splice(pointsIndex, 0, newColumn);
      return newConfig;
    });

    // 기존 데이터에 새 컬럼 필드 추가
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => ({
          ...item,
          [newColumn.id]: ''
        }))
      }))
    }));

    showNotification('새 컬럼이 추가되었습니다!');
  };

  const deleteColumn = (columnId: string) => {
    const column = columnConfig.find(col => col.id === columnId);
    if (column?.required) {
      showNotification('필수 컬럼은 삭제할 수 없습니다.', 'error');
      return;
    }

    setColumnConfig(prev => prev.filter(col => col.id !== columnId));

    // 기존 데이터에서 해당 컬럼 필드 제거
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          const newItem = { ...item };
          delete newItem[columnId];
          return newItem;
        })
      }))
    }));

    showNotification('컬럼이 삭제되었습니다!');
  };

  const updateScore = (sectionId: string, itemId: number, score: number) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map(item =>
                item.id === itemId ? { ...item, score: Math.min(score, item.points) } : item
              )
            }
          : section
      )
    }));
  };

  const addSection = () => {
    const newId = String.fromCharCode(65 + currentTemplate.sections.length);
    setCurrentTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, {
        id: newId,
        title: '새 평가영역',
        totalPoints: 10,
        items: [{ id: 1, text: '새 평가항목', type: '정량', points: 10, score: 0 }]
      }]
    }));
  };

  const deleteSection = (sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter(section => section.id !== sectionId)
    }));
  };

  const addItem = (sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: [...section.items, {
                id: Math.max(...section.items.map(i => i.id)) + 1,
                text: '새 평가항목',
                type: '정량',
                points: 5,
                score: 0
              }]
            }
          : section
      )
    }));
  };

  const deleteItem = (sectionId: string, itemId: number) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.filter(item => item.id !== itemId)
            }
          : section
      )
    }));
  };

  const updateItem = (sectionId: string, itemId: number, field: string, value: any) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
              )
            }
          : section
      )
    }));
  };

  const updateSection = (sectionId: string, field: string, value: any) => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, [field]: value } : section
      )
    }));
  };

  const saveTemplate = () => {
    // 현재 날짜와 시간으로 파일명 생성
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const fileName = `평가표_${currentTemplate.title.replace(/[^\w\s]/gi, '')}_${dateStr}_${timeStr}.json`;

    // 평가위원 정보와 컬럼 설정도 포함해서 저장
    const templateWithAll = {
      ...currentTemplate,
      evaluator: evaluator,
      columnConfig: columnConfig
    };

    const dataStr = JSON.stringify(templateWithAll, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();

    showNotification('✅ 템플릿이 저장되었습니다!');
  };

  const loadTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const template = JSON.parse(e.target?.result as string);

          // 템플릿 유효성 검사
          if (!template.title || !template.sections || !Array.isArray(template.sections)) {
            throw new Error('올바르지 않은 템플릿 형식입니다.');
          }

          // 평가위원 정보가 있으면 같이 불러오기
          if (template.evaluator) {
            setEvaluator(template.evaluator);
          }

          // 컬럼 설정이 있으면 같이 불러오기
          if (template.columnConfig) {
            setColumnConfig(template.columnConfig);
          }

          setCurrentTemplate(template);
          showNotification('✅ 템플릿이 성공적으로 불러와졌습니다!', 'info');

        } catch (error: any) {
          showNotification('❌ ' + error.message, 'error');
        }
      };
      reader.readAsText(file);
    }

    // 파일 입력 초기화 (같은 파일 다시 선택 가능)
    event.target.value = '';
  };

  // 점수 초기화 함수
  const resetScores = () => {
    setCurrentTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => ({ ...item, score: 0 }))
      }))
    }));
    showNotification('모든 점수가 초기화되었습니다!', 'success');
  };

  // 🎯 일반 인쇄 기능 (통합 함수 사용)
  const printTemplate = () => {
    // 평가위원 정보 결정 (선택된 평가위원 우선, 없으면 수동 입력)
    const evaluatorInfo = selectedEvaluatorInfo || evaluator;

    // 평가대상 정보 결정
    const candidateInfo = candidates.find((c: any) => c.id === selectedCandidate);

    // 통합 HTML 생성 함수 사용
    const evaluationContent = generateEvaluationHTML(evaluatorInfo, candidateInfo);

    // 제목 결정
    const dynamicTitle = candidateInfo ? `${candidateInfo.name} 심사표` : currentTemplate.title;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.', 'error');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>평가표 출력 - ${dynamicTitle}</title>
          <meta charset="UTF-8">
          ${getPrintStyle()}
        </head>
        <body>
          <div class="evaluation-page">
            ${evaluationContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();

    showNotification('인쇄 미리보기가 열렸습니다!', 'info');
  };

  // 🎯 배치 인쇄 기능 (통합 함수 사용) + 추후 확장 대비
  const printAllCombinations = () => {
    if (candidates.length === 0 || evaluators.length === 0) {
      showNotification('평가대상과 평가위원이 모두 등록되어야 배치 인쇄가 가능합니다.', 'error');
      return;
    }

    let allPrintContent = '';
    const totalPages = candidates.length * evaluators.length;

    candidates.forEach((candidate, candidateIndex) => {
      evaluators.forEach((evaluator, evaluatorIndex) => {
        // 🎯 일반 인쇄와 완전히 동일한 로직 사용
        const evaluationContent = generateEvaluationHTML(evaluator, candidate);

        allPrintContent += `
          <div class="evaluation-page">
            ${evaluationContent}
          </div>
        `;
      });
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.', 'error');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>전체 평가표 배치 인쇄 (${totalPages}페이지)</title>
          <meta charset="UTF-8">
          ${getPrintStyle()}
        </head>
        <body>
          ${allPrintContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
    showNotification(`총 ${totalPages}개의 평가표가 생성되었습니다!`, 'info');
  };

  // 🚀 추후 확장용: 평가위원별 일괄 인쇄
  const printByEvaluator = (evaluatorId) => {
    const evaluator = evaluators.find(e => e.id === evaluatorId);
    if (!evaluator || candidates.length === 0) return;

    let printContent = '';
    candidates.forEach(candidate => {
      const evaluationContent = generateEvaluationHTML(evaluator, candidate);
      printContent += `<div class="evaluation-page">${evaluationContent}</div>`;
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${evaluator.name} 평가위원 전체 평가표</title>
            <meta charset="UTF-8">
            ${getPrintStyle()}
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // 🚀 추후 확장용: 평가대상별 일괄 인쇄
  const printByCandidate = (candidateId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || evaluators.length === 0) return;

    let printContent = '';
    evaluators.forEach(evaluator => {
      const evaluationContent = generateEvaluationHTML(evaluator, candidate);
      printContent += `<div class="evaluation-page">${evaluationContent}</div>`;
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${candidate.name} 평가대상 전체 평가표</title>
            <meta charset="UTF-8">
            ${getPrintStyle()}
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const createCategoryMutation = useMutation({
    mutationFn: async (category: typeof newCategory) => {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({ title: "성공", description: "평가 카테고리가 추가되었습니다." });
      setIsAddingCategory(false);
      setNewCategory({ categoryCode: "", categoryName: "", description: "" });
    },
    onError: () => {
      toast({ title: "오류", description: "카테고리 추가에 실패했습니다.", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const response = await fetch("/api/admin/evaluation-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          categoryId: parseInt(item.categoryId),
          maxScore: parseInt(item.maxScore),
          weight: parseFloat(item.weight),
        }),
      });
      if (!response.ok) throw new Error("Failed to create item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/evaluation-items"] });
      toast({ title: "성공", description: "평가 항목이 추가되었습니다." });
      setIsAddingItem(false);
      setNewItem({ categoryId: "", itemCode: "", itemName: "", description: "", maxScore: "", weight: "" });
    },
    onError: () => {
      toast({ title: "오류", description: "평가 항목 추가에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCategoryMutation.mutate(newCategory);
  };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createItemMutation.mutate(newItem);
  };

  if (categoriesLoading || itemsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">평가항목 관리</h1>
            <p className="text-lg text-gray-600">평가 카테고리와 항목을 관리할 수 있습니다.</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              엑셀 업로드
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </div>

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList>
            <TabsTrigger value="categories">평가 카테고리</TabsTrigger>
            <TabsTrigger value="items">평가 항목</TabsTrigger>
            <TabsTrigger value="template">평가표 템플릿</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">평가 카테고리</h2>
                <Button onClick={() => setIsAddingCategory(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  카테고리 추가
                </Button>
              </div>

              {isAddingCategory && (
                <Card>
                  <CardHeader>
                    <CardTitle>새 카테고리 추가</CardTitle>
                    <CardDescription>평가 카테고리 정보를 입력하세요.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCategorySubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">카테고리 코드</label>
                          <Input
                            value={newCategory.categoryCode}
                            onChange={(e) => setNewCategory({ ...newCategory, categoryCode: e.target.value })}
                            required
                            placeholder="예: TECH"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">카테고리 이름</label>
                          <Input
                            value={newCategory.categoryName}
                            onChange={(e) => setNewCategory({ ...newCategory, categoryName: e.target.value })}
                            required
                            placeholder="예: 기술 역량"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">설명</label>
                          <Input
                            value={newCategory.description}
                            onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                            placeholder="카테고리에 대한 설명"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button type="submit" disabled={createCategoryMutation.isPending}>
                          {createCategoryMutation.isPending ? "추가 중..." : "추가"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsAddingCategory(false)}>
                          취소
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>카테고리 목록</CardTitle>
                  <CardDescription>총 {categories.length}개의 카테고리가 등록되어 있습니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categories.map((category: any) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div>
                            <h3 className="font-semibold">{category.categoryName}</h3>
                            <p className="text-sm text-gray-600">
                              {category.categoryCode} · {category.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? "활성" : "비활성"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {categories.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        등록된 카테고리가 없습니다.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="items">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">평가 항목</h2>
                <Button 
                  onClick={() => setIsAddingItem(true)}
                  disabled={categories.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  항목 추가
                </Button>
              </div>

              {categories.length === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-gray-500">
                      평가 항목을 추가하려면 먼저 카테고리를 생성해주세요.
                    </p>
                  </CardContent>
                </Card>
              )}

              {isAddingItem && categories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>새 평가 항목 추가</CardTitle>
                    <CardDescription>평가 항목 정보를 입력하세요.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleItemSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">카테고리</label>
                          <select
                            className="w-full px-3 py-2 border rounded-md"
                            value={newItem.categoryId}
                            onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
                            required
                          >
                            <option value="">카테고리 선택</option>
                            {categories.map((category: any) => (
                              <option key={category.id} value={category.id}>
                                {category.categoryName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">항목 코드</label>
                          <Input
                            value={newItem.itemCode}
                            onChange={(e) => setNewItem({ ...newItem, itemCode: e.target.value })}
                            required
                            placeholder="예: TECH001"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">항목 이름</label>
                          <Input
                            value={newItem.itemName}
                            onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                            required
                            placeholder="예: 프로그래밍 능력"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">최대 점수</label>
                          <Input
                            type="number"
                            value={newItem.maxScore}
                            onChange={(e) => setNewItem({ ...newItem, maxScore: e.target.value })}
                            required
                            placeholder="예: 100"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">가중치</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={newItem.weight}
                            onChange={(e) => setNewItem({ ...newItem, weight: e.target.value })}
                            required
                            placeholder="예: 1.0"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">설명</label>
                          <Input
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            placeholder="평가 항목에 대한 설명"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button type="submit" disabled={createItemMutation.isPending}>
                          {createItemMutation.isPending ? "추가 중..." : "추가"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsAddingItem(false)}>
                          취소
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>평가 항목 목록</CardTitle>
                  <CardDescription>총 {items.length}개의 평가 항목이 등록되어 있습니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div>
                            <h3 className="font-semibold">{item.itemName}</h3>
                            <p className="text-sm text-gray-600">
                              {item.itemCode} · {item.categoryName} · 최대 {item.maxScore}점 · 가중치 {item.weight}
                            </p>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={item.isActive ? "default" : "secondary"}>
                            {item.isActive ? "활성" : "비활성"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        등록된 평가 항목이 없습니다.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="template">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>평가표 템플릿</CardTitle>
                      <CardDescription>평가표를 디자인하고 관리합니다.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setIsEditing(!isEditing)}
                        variant={isEditing ? "default" : "outline"}
                        size="sm"
                      >
                        {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
                        {isEditing ? "편집 완료" : "편집"}
                      </Button>
                      <Button onClick={saveTemplate} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        저장
                      </Button>
                      <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        불러오기
                      </Button>
                      <Button onClick={resetScores} variant="outline" size="sm">
                        <X className="h-4 w-4 mr-2" />
                        점수 초기화
                      </Button>
                      <Button onClick={printTemplate} variant="outline" size="sm">
                        <Printer className="h-4 w-4 mr-2" />
                        인쇄
                      </Button>
                      {isEditing && (
                        <>
                          <Button onClick={addSection} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            영역 추가
                          </Button>
                          <Button onClick={addColumn} size="sm" variant="secondary">
                            <Plus className="h-4 w-4 mr-2" />
                            컬럼 추가
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={loadTemplate}
                    accept=".json"
                    className="hidden"
                  />

                  {/* 평가위원 및 평가대상 선택 */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <h3 className="text-sm font-bold mb-3 text-blue-800">평가위원 및 평가대상 선택</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium mb-2 text-gray-700">평가위원 선택</label>
                        <select
                          value={selectedEvaluator || ''}
                          onChange={(e) => setSelectedEvaluator(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full text-sm border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">평가위원을 선택하세요</option>
                          {(evaluators as any[]).map((evaluator: any) => (
                            <option key={evaluator.id} value={evaluator.id}>
                              {evaluator.name} ({evaluator.department})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-2 text-gray-700">평가대상 선택</label>
                        <select
                          value={selectedCandidate || ''}
                          onChange={(e) => setSelectedCandidate(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full text-sm border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">평가대상을 선택하세요</option>
                          {(candidates as any[]).map((candidate: any) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name} ({candidate.department})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 🚀 개선된 인쇄 옵션 (추후 확장 대비) */}
                    <div className="mt-4 space-y-3">
                      {/* 전체 배치 인쇄 */}
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-blue-800">전체 배치 인쇄</div>
                          <div className="text-xs text-gray-600">모든 평가위원 × 모든 평가대상 ({candidates.length}명 × {evaluators.length}명 = {candidates.length * evaluators.length}페이지)</div>
                        </div>
                        <Button 
                          onClick={printAllCombinations}
                          variant="default"
                          size="sm"
                          disabled={candidates.length === 0 || evaluators.length === 0}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          전체 인쇄
                        </Button>
                      </div>

                      {/* 🚀 추후 확장용: 개별 선택 인쇄 옵션들 */}
                      {(candidates.length > 0 && evaluators.length > 0) && (
                        <div className="grid grid-cols-2 gap-3">
                          {/* 평가위원별 인쇄 */}
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="font-medium text-sm text-gray-700 mb-2">평가위원별 일괄 인쇄</div>
                            <div className="text-xs text-gray-500 mb-2">특정 평가위원의 모든 평가표</div>
                            <select 
                              className="w-full text-xs border rounded px-2 py-1 bg-white mb-2"
                              onChange={(e) => e.target.value && printByEvaluator(parseInt(e.target.value))}
                              defaultValue=""
                            >
                              <option value="">평가위원 선택</option>
                              {evaluators.map((evaluator: any) => (
                                <option key={evaluator.id} value={evaluator.id}>
                                  {evaluator.name} ({candidates.length}페이지)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 평가대상별 인쇄 */}
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="font-medium text-sm text-gray-700 mb-2">평가대상별 일괄 인쇄</div>
                            <div className="text-xs text-gray-500 mb-2">특정 평가대상의 모든 평가표</div>
                            <select 
                              className="w-full text-xs border rounded px-2 py-1 bg-white mb-2"
                              onChange={(e) => e.target.value && printByCandidate(parseInt(e.target.value))}
                              defaultValue=""
                            >
                              <option value="">평가대상 선택</option>
                              {candidates.map((candidate: any) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name} ({evaluators.length}페이지)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 인쇄 팁 */}
                      <div className="text-xs text-gray-600 p-2 bg-orange-50 rounded border-l-4 border-orange-400">
                        <span className="text-orange-600 font-medium">💡 인쇄 팁:</span> 브라우저 인쇄 설정에서 '머리글 및 바닥글' 옵션을 해제하면 더 깨끗한 출력이 가능합니다
                      </div>
                    </div>
                  </div>

                  {/* 평가위원 정보 편집 (편집 모드에서만 표시) */}
                  {isEditing && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h3 className="text-sm font-bold mb-3 text-yellow-800">수동 평가위원 정보 입력</h3>
                      <div className="text-xs text-yellow-700 mb-3">
                        위에서 평가위원을 선택하지 않은 경우 수동으로 입력할 수 있습니다.
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium mb-1">이름</label>
                          <Input
                            value={evaluator.name}
                            onChange={(e) => setEvaluator(prev => ({ ...prev, name: e.target.value }))}
                            className="text-sm"
                            placeholder="평가위원 이름"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">직책</label>
                          <Input
                            value={evaluator.position}
                            onChange={(e) => setEvaluator(prev => ({ ...prev, position: e.target.value }))}
                            className="text-sm"
                            placeholder="직책"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">소속기관</label>
                          <Input
                            value={evaluator.department}
                            onChange={(e) => setEvaluator(prev => ({ ...prev, department: e.target.value }))}
                            className="text-sm"
                            placeholder="소속기관"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 컬럼 관리 (편집 모드에서만 표시) */}
                  {isEditing && (
                    <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h3 className="text-sm font-bold mb-3 text-amber-800">컬럼 설정</h3>
                      <div className="mb-4 p-3 bg-amber-100 rounded-md border-l-4 border-amber-400">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-xs text-amber-800">
                              <strong>제목박스의 컬럼 표시/숨김을 설정할 수 있습니다. 필수 컬럼은 삭제할 수 없습니다.</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {columnConfig.map((column) => (
                          <div key={column.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                            <Input
                              value={column.title}
                              onChange={(e) => updateColumnConfig(column.id, 'title', e.target.value)}
                              className="w-32 text-xs"
                              disabled={column.required}
                            />
                            <select
                              value={column.type}
                              onChange={(e) => updateColumnConfig(column.id, 'type', e.target.value)}
                              className="text-xs border rounded px-2 py-1 bg-white"
                              disabled={column.required}
                            >
                              <option value="text">텍스트</option>
                              <option value="number">숫자</option>
                              <option value="select">선택</option>
                            </select>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={column.visible}
                                onChange={(e) => updateColumnConfig(column.id, 'visible', e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-xs">표시</span>
                            </label>
                            <div className="text-xs text-gray-500">
                              {column.required ? '필수' : '선택'}
                            </div>
                            {!column.required && (
                              <Button
                                onClick={() => deleteColumn(column.id)}
                                size="sm"
                                variant="outline"
                                className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 인쇄용 영역 */}
                  <div id="template-print-area">
                    {/* 제목과 구분 정보 표 */}
                    <div className="overflow-x-auto mb-0">
                      <table className="w-full border-collapse border border-gray-400 text-sm">
                        <tbody>
                          <tr>
                            <td colSpan={2} className="border-t border-l border-r border-gray-400 p-2 text-sm text-right">
                              {selectedCandidateInfo && (
                                <span>구분 : {selectedCandidateInfo.category || selectedCandidateInfo.department}</span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="border-l border-r border-b border-gray-400 p-4 text-center text-lg font-bold title">
                              {selectedCandidateInfo ? getDynamicTitle() : currentTemplate.title}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 평가표 데이터 테이블 */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-400 text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-400 px-4 py-3 text-center font-bold">구분 ({currentTemplate.sections.reduce((sum, section) => sum + section.items.reduce((itemSum, item) => itemSum + item.points, 0), 0)}점)</th>
                            <th className="border border-gray-400 px-4 py-3 text-center font-bold">세부 항목</th>
                            {columnConfig.filter(col => col.visible && !['section', 'item'].includes(col.id)).map(column => (
                              <th key={column.id} className="border border-gray-400 px-2 py-3 text-center font-bold w-16">
                                {column.title}
                              </th>
                            ))}
                            {isEditing && <th className="border border-gray-400 px-2 py-3 text-center font-bold w-20">관리</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {currentTemplate.sections.flatMap((section) => 
                            section.items.map((item, itemIndex) => (
                                <tr key={`${section.id}-${item.id}`} className="hover:bg-gray-50">
                                  {itemIndex === 0 && (
                                    <td 
                                      className="border border-gray-400 px-4 py-3 font-medium bg-blue-50 align-top text-center"
                                      rowSpan={section.items.length}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="w-full">
                                          {isEditing ? (
                                            <Input
                                              value={section.title}
                                              onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                                              className="font-bold text-sm bg-transparent border-b border-gray-300"
                                            />
                                          ) : (
                                            <span className="font-bold text-sm">{section.id}. {section.title}</span>
                                          )}
                                          <div className="text-xs text-gray-600 mt-1 text-center">
                                            ({calculateSectionScore(section)}점)
                                          </div>
                                        </div>
                                        {isEditing && (
                                          <div className="flex flex-col gap-1 ml-2">
                                            <Button
                                              onClick={() => addItem(section.id)}
                                              size="sm"
                                              variant="outline"
                                              className="h-6 w-6 p-0"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              onClick={() => deleteSection(section.id)}
                                              size="sm"
                                              variant="outline"
                                              className="h-6 w-6 p-0"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  <td className="border border-gray-400 px-4 py-2">
                                    {isEditing ? (
                                      <Input
                                        value={item.text}
                                        onChange={(e) => updateItem(section.id, item.id, 'text', e.target.value)}
                                        className="text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm">{itemIndex + 1}. {item.text}</span>
                                    )}
                                  </td>

                                  {columnConfig.filter(col => col.visible && !['section', 'item'].includes(col.id)).map(column => (
                                    <td key={column.id} className={`border border-gray-400 px-2 py-2 text-center ${column.id === 'type' ? 'type-cell' : column.id === 'points' ? 'points-cell' : column.id === 'score' ? 'score-cell' : ''}`}>
                                      {column.id === 'score' ? (
                                        <div className="flex justify-center items-center">
                                          <Input
                                            type="number"
                                            value={item.score}
                                            onChange={(e) => updateScore(section.id, item.id, parseInt(e.target.value) || 0)}
                                            max={item.points}
                                            min={0}
                                            className="text-xs text-center w-16 mx-auto"
                                          />
                                        </div>
                                      ) : isEditing ? (
                                        column.id === 'type' ? (
                                          <div className="flex justify-center items-center">
                                            <select
                                              value={item.type}
                                              onChange={(e) => updateItem(section.id, item.id, 'type', e.target.value)}
                                              className="text-xs border rounded px-1 py-1 text-center mx-auto"
                                            >
                                              <option value="정량">정량</option>
                                              <option value="정성">정성</option>
                                            </select>
                                          </div>
                                        ) : (
                                          <div className="flex justify-center items-center">
                                            <Input
                                              type={column.type === 'number' ? 'number' : 'text'}
                                              value={item[column.id] || (column.type === 'number' ? 0 : '')}
                                              onChange={(e) => updateItem(section.id, item.id, column.id, column.type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value)}
                                              className="text-xs text-center w-12 mx-auto"
                                            />
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-xs">
                                          {column.id === 'points' ? `${item[column.id]}점` : 
                                           column.id === 'score' ? item[column.id] :
                                           item[column.id]}
                                        </span>
                                      )}
                                    </td>
                                  ))}

                                  {isEditing && (
                                    <td className="border border-gray-400 px-2 py-2 text-center">
                                      <Button
                                        onClick={() => deleteItem(section.id, item.id)}
                                        size="sm"
                                        variant="outline"
                                        className="h-6 w-6 p-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))
                          )}
                          {/* 합계 행 */}
                          <tr className="bg-gray-100 font-bold">
                            <td className="border border-gray-400 px-4 py-3 text-center">합계</td>
                            <td className="border border-gray-400 px-4 py-3"></td>
                            {columnConfig.filter(col => col.visible && !['section', 'item'].includes(col.id)).map(column => (
                              <td key={column.id} className="border border-gray-400 px-2 py-3 text-center">
                                {column.id === 'points' ? (
                                  `${currentTemplate.sections.reduce((sum, section) => sum + section.items.reduce((itemSum, item) => itemSum + item.points, 0), 0)}점`
                                ) : column.id === 'score' ? (
                                  <span className="text-lg font-bold">{calculateTotalScore()}점</span>
                                ) : ''}
                              </td>
                            ))}
                            {isEditing && <td className="border border-gray-400 px-2 py-3"></td>}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Bell, HelpCircle, MessageSquare, Search, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_ITEMS = [
  {
    id: 'calendar',
    title: 'Calendar',
    section: 'Suggestions',
    icon: <ArrowRight size={16} />,
    action: () => {},
  },
  {
    id: 'profile',
    title: 'Profile',
    section: 'Settings',
    icon: <User size={16} />,
    shortcut: 'P',
    action: () => {},
  },
  {
    id: 'notifications',
    title: 'Notifications',
    section: 'Settings',
    icon: <Bell size={16} />,
    shortcut: 'N',
    action: () => {},
  },
  {
    id: 'faq',
    title: 'FAQ',
    section: 'Help',
    icon: <HelpCircle size={16} />,
    action: () => {},
  },
  {
    id: 'messages',
    title: 'Messages',
    section: 'Help',
    icon: <MessageSquare size={16} />,
    action: () => {},
  },
];

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;
}

function getItemSearchText(item) {
  return [
    item.title,
    item.section,
    item.description,
    ...(Array.isArray(item.keywords) ? item.keywords : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function CommandSearch({
  items = DEFAULT_ITEMS,
  triggerLabel = 'Find...',
  placeholder = 'Find...',
  ariaLabel = 'Open command search',
  emptyLabel = 'No results found',
  shortcutKey = 'f',
  shortcutLabel = 'F',
  className = '',
  id = 'command-search',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const normalizedShortcutKey = typeof shortcutKey === 'string' && shortcutKey.length ? shortcutKey.toLowerCase() : null;

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return undefined;
    }
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (normalizedShortcutKey && event.key.toLowerCase() === normalizedShortcutKey && !isOpen && !isTypingTarget(document.activeElement)) {
        event.preventDefault();
        setIsOpen(true);
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, normalizedShortcutKey]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return items;
    return items.filter((item) => getItemSearchText(item).includes(cleanQuery));
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items]);

  const sections = useMemo(() => {
    const groups = new Map();
    filteredItems.forEach((item) => {
      const sectionName = item.section || 'Commands';
      if (!groups.has(sectionName)) groups.set(sectionName, []);
      groups.get(sectionName).push(item);
    });
    return Array.from(groups.entries()).map(([name, sectionItems]) => ({ name, items: sectionItems }));
  }, [filteredItems]);

  const runItem = (item) => {
    item.action?.();
    setIsOpen(false);
  };

  const handleSearchKeyDown = (event) => {
    if (!filteredItems.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previous) => (previous + 1) % filteredItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => (previous - 1 + filteredItems.length) % filteredItems.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selectedItem = filteredItems[activeIndex];
      if (selectedItem) runItem(selectedItem);
    }
  };

  const transition = {
    type: 'tween',
    ease: 'easeOut',
    duration: 0.15,
  };

  return (
    <>
      <AnimatePresence mode="popLayout">
        {isOpen ? (
          <motion.div
            className="command-search__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <div ref={rootRef} className={joinClasses('command-search', className)}>
        <AnimatePresence mode="popLayout">
          {!isOpen ? (
            <motion.button
              key="trigger"
              type="button"
              className="command-search__trigger"
              layoutId={`${id}-surface`}
              transition={transition}
              aria-label={ariaLabel}
              onClick={() => setIsOpen(true)}
            >
              <motion.span className="command-search__trigger-icon" layoutId={`${id}-icon`} transition={transition} aria-hidden="true">
                <Search size={15} />
              </motion.span>
              <motion.span className="command-search__trigger-label" layoutId={`${id}-label`} transition={transition}>
                {triggerLabel}
              </motion.span>
              {shortcutLabel ? (
                <motion.span className="command-search__trigger-kbd" layoutId={`${id}-shortcut`} transition={transition}>
                  {shortcutLabel}
                </motion.span>
              ) : null}
            </motion.button>
          ) : (
            <motion.div
              key="panel"
              className="command-search__panel"
              layoutId={`${id}-surface`}
              transition={transition}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="command-search__header">
                <motion.span className="command-search__header-icon" layoutId={`${id}-icon`} transition={transition} aria-hidden="true">
                  <Search size={17} />
                </motion.span>
                <div className="command-search__input-shell">
                  <input
                    ref={inputRef}
                    className="command-search__input"
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    aria-label={placeholder}
                  />
                  {!query ? (
                    <motion.span className="command-search__placeholder" layoutId={`${id}-label`} transition={transition}>
                      {placeholder}
                    </motion.span>
                  ) : null}
                </div>
                <span className="command-search__escape">Esc</span>
              </div>

              <div className="command-search__results">
                {filteredItems.length === 0 ? (
                  <div className="command-search__empty">
                    {emptyLabel} {query ? `for "${query}"` : ''}
                  </div>
                ) : (
                  sections.map((section) => (
                    <div className="command-search__section" key={section.name}>
                      <h3 className="command-search__section-title">{section.name}</h3>
                      <div className="command-search__section-items">
                        {section.items.map((item) => {
                          const globalIndex = filteredItems.findIndex((filteredItem) => filteredItem.id === item.id);
                          const isActive = globalIndex === activeIndex;
                          return (
                            <button
                              className={joinClasses('command-search__item', isActive && 'is-active', item.isSelected && 'is-selected')}
                              key={item.id}
                              type="button"
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              onClick={() => runItem(item)}
                            >
                              <span className="command-search__item-main">
                                <span className="command-search__item-icon" aria-hidden="true">
                                  {item.icon || <ArrowRight size={16} />}
                                </span>
                                <span className="command-search__item-text">
                                  <span className="command-search__item-title">{item.title}</span>
                                  {item.description ? <span className="command-search__item-description">{item.description}</span> : null}
                                </span>
                              </span>
                              {item.shortcut ? <span className="command-search__item-shortcut">{item.shortcut}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
